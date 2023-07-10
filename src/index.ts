/* tslint:disable-next-line */
const config = require("dotenv").config();
import * as logger from "./logger";
import { lookupSeries } from "./match";
import { priceCoin } from "./price";
import { formatDate, getScrapedDates, loadPriceFiles, readCoins, writeCoinPrices } from "./utils";

const formatPrice = (price: number): string => {
  const zeroPad = (d: number) => {
    return (`0${d}`).slice(-2);
  };

  return `$${Math.floor(price / 100)}.${zeroPad(price % 100)}`;
};

// Prices one coin, returning two values - a price (as a string) and an explanation
const priceOneCoin = async (
  coin: {
    series: string | undefined,
    grade: string,
    details: string | undefined,
    year: string,
    variety?: string,
    value: string,
  },
  as_of: Date[]): Promise<{ prices: {[s: string]: string}, explanation: string }> => {
  // Let's transform the grade - we will only take the numeric designation
  // and an indication of whether it is proof
  // That means we'll lose any "+" designation for now
  const prices: { [s: string]: string } = {};
  let i: number;
  let explanation: string | undefined;
  let grade: number = parseInt(coin.grade.replace(/[^0-9]+/g, ""), 10);
  const proof: boolean = coin.grade.toLowerCase().indexOf("pr") > -1;
  if (isNaN(grade) && proof) {
    // We'll count this as a PR-60 for now
    grade = 60;
  }

  // Details might be an array of a few different things (i.e. 1909 VDB Lincoln Cent)
  const detailValues = (coin.details || "").split("|").map((d) => d.trim());
  let series: string | undefined = coin.series;
  if (!coin.series) {
    const values = lookupSeries(coin.year, coin.value, proof);
    if (!values) {
      explanation = "No matching series found";
    } else if (values.length > 1) {
      // It's possible details clarifies the series
      series = detailValues.find((d) => values.some((v) => v.toLowerCase() === d.toLowerCase()));
      if (!series) {
        explanation = `Multiple matching series: ${values.join(", ")}`;
      }
    } else {
      // Just one match, so use it
      series = values[0];
    }
  }

  if (series) {
    // Read price files
    for (i = 0; i < as_of.length; i++) {
      const date = (as_of[i]);
      const coinPrice = await priceCoin(series, coin.year, coin.variety, grade, date, detailValues);
      if (coinPrice.price) {
        prices[formatDate(coinPrice.price_as_of)] = formatPrice(coinPrice.price);

        // If this was not an exact price, then let's note that in the explanation
        if (!explanation && (coinPrice.price_below || coinPrice.price_above)) {
          const closeMatches: string[] = [];
          if (coinPrice.price_below) {
            closeMatches.push(`Grade ${coinPrice.price_below.grade} at ${formatPrice(coinPrice.price_below.price)}`);
          }
          if (coinPrice.price_above) {
            closeMatches.push(`Grade ${coinPrice.price_above.grade} at ${formatPrice(coinPrice.price_above.price)}`);
          }
          explanation = `No exact price found - closest matches were ${closeMatches.join(" and ")}`;
        }
      }

      if (!explanation && coinPrice.errorCode) {
        explanation = `${coinPrice.errorCode}. ${explanation || ""}`.trim();
      }
    }
  }

  return { prices, explanation: explanation || "" };
};

exports.handler = async (event: any, context: any) => {
  // You need to supply a series, year, and grade at minimum
  logger.info("received event", { event });

  const coins = await readCoins();
  const pricedCoins: { year: string, value: string, grade: string, variety?: string, prices: { [s: string]: string }, explanation: string }[] = [];
  let as_of_dates: Date[];

  if (!await loadPriceFiles(event)) {
    logger.info("Couldn't load pricelists", { event });
    return;
  }

  if (event?.start) {
    // This means that we need to read a range of dates - first get a list of all potential dates
    // Then filter to those that come after the start date
    const s: Date = new Date(event.start);
    const e: Date = event.end ? new Date(event.end) : new Date();
    as_of_dates = await getScrapedDates();
  } else {
    as_of_dates = [event?.date ? new Date(event.date) : new Date()];
  }

  let i: number;
  for (i = 0; i < coins.length; i++) {
    const coin = {
      year: coins[i].year,
      value: coins[i].value,
      details: coins[i].details,
      grade: coins[i].grade,
      variety: coins[i].variety,
      series: undefined,
    };
    logger.info("Read coin", { coin });

    const result: { prices: { [s: string]: string }, explanation: string } = await priceOneCoin(coin, as_of_dates);
    pricedCoins.push({ ...coin, ...result });
  }

  // Now let's write the result out
  await writeCoinPrices(pricedCoins);

  return pricedCoins;
};
