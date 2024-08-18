import chromium from "chrome-aws-lambda";
import * as logger from "./logger";
import { CoinSeries } from "./utils";

let puppeteer: any;
try {
  /* tslint:disable-next-line */
  puppeteer = require("puppeteer-extra");
} catch (e) {
  puppeteer = null;
}

const launchBrowser = async () => {
  let browser;

  if (puppeteer) {
    const stealthPlugin = require("puppeteer-extra-plugin-stealth");
    puppeteer.use(stealthPlugin());
    browser = await puppeteer.launch();
  } else {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
  }

  return browser;
};

const readRow = async (page: any, row: number): Promise<{ success: boolean, proofSet?: string, price?: number }> => {
  const result: { success: boolean, proofSet?: string, price?: number } = { success: false };

  try {
    const priceRow: number = 3 + row;

    // Second column is the proof set name, fourth column is the price
    const name: string = await page.evaluate(async (sel: any) => {
      return document.querySelector(sel)?.innerText;
    }, `#mainContent > div.container-fluid.padding-bottom > div:nth-child(6) > div > table > tbody > tr:nth-child(${priceRow}) > td:nth-child(2)`);
    if (!name) {
      // Looks like this row doesn't exist
      return result;
    }
    // Get proof set name - name has newline characters, and it's the last line
    result.proofSet = name.split("\n").pop()?.trim();
    const priceStr: string = await page.evaluate(async (sel: any) => {
      return document.querySelector(sel)?.innerText;
    }, `#mainContent > div.container-fluid.padding-bottom > div:nth-child(6) > div > table > tbody > tr:nth-child(${priceRow}) > td:nth-child(4)`);

    result.price = 100 * parseFloat(priceStr.replace(/[^0-9\.]+/g, ""));
    if (isNaN(result.price)) {
      logger.info("Problem getting price!", { row, result });
      return result;
    }

    // Got it!
    result.success = true;
  } catch(e) {
    logger.error((e as any)?.message, `Error in row ${row}`);
  }

  return result;
};

export const readProofSetPrices = async (): Promise<CoinSeries> => {
  const coinSeries: CoinSeries = { name: "Proof Sets", issues: [] };
  let page: any;
  const browser = await launchBrowser();

  try {
    page = await browser.newPage();

    // Don't load images, JSS, CSS
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      if (["image", "font", "stylesheet", "javascript"].indexOf(req.resourceType()) > -1) {
        req.abort();
      }
      else {
        req.continue();
      }
    });

    // Make sure the full page loads
    await page.goto(process.env.PROOFSETURL, {
      waitUntil: "load",
      timeout: 0
    });

    // OK, read each row starting with the first
    // Note that there are some "hidden rows" that we need to skip over
    // We'll continue in our loop until we get two consecutive rows with no data
    let row: number = 0;
    let missingRows: number = 0;
    let result: { success: boolean, proofSet?: string, price?: number };
    do {
      result = await readRow(page, row);
      row++;

      if (result?.success) {
        // Convert to a CoinIssue
        // Note we don't have a grade for proof sets, so we'll just use 60, 65, 70
        missingRows = 0;
        coinSeries.issues.push({
          name: result.proofSet || "",
          prices: [
            { grade: 60, price: result.price || 0 },
            { grade: 65, price: result.price || 0 },
            { grade: 70, price: result.price || 0 },
          ],
        });
      } else {
        missingRows++;
      }
    } while (missingRows < 2);

    await page.close();
  } catch(e) {
    logger.error((e as any)?.message, `Error reading ${coinSeries.name}`);
  }

  logger.info("Finished reading prices", { coinSeries });

  await browser.close();
  return coinSeries;
};
