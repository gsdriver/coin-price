/* tslint:disable-next-line */
const config = require("dotenv").config();

import * as logger from "./logger";
import { CoinIssue, CoinPrice, CoinSeries, getPriceFiles } from "./utils";

// If missing mintmark, then put on "p" for Philadelphia
const getMintMark = (str: string): string => {
  const validMintMarks: string[] = ["p", "d", "s", "w", "c", "o", "cc"];
  const match = validMintMarks.find((m) => (str.toLowerCase().trim().indexOf(m) > -1));

  return match || "p";
};

const yearMatch = (year1: string, year2: string, detail: string | undefined): boolean => {
  // We need to split out year and mintmark
  // If missing mintmark, then put on "P" for Philadelphia
  const component1 = year1.split(/[ ,-]+/);
  const component2 = (detail?.length ? `${year2} ${detail}` : year2).split(/[ ,-]+/);
  let match = false;

  if (component1[0].trim() === component2[0].trim()) {
    const mintmark1 = (component1.length > 1) ? getMintMark(component1[1]) : "p";
    const mintmark2 = (component2.length > 1) ? getMintMark(component2[1]) : "p";

    match = (mintmark1 === mintmark2);
  }

  return match;
};

export const priceCoin = async (series: string, year: string, variety: string | undefined, grade: number, date: Date | undefined, details: string[]):
  Promise<{ errorCode?: string, price?: number, price_as_of?: Date, price_below?: CoinPrice, price_above?: CoinPrice }> => {
  // First, read price files
  let errorCode: string | undefined;
  let price: number | undefined;
  let price_below: CoinPrice | undefined;
  let price_above: CoinPrice | undefined;
  let price_as_of: Date | undefined;
  const d = (date ? new Date(date) : new Date());

  const prices: CoinSeries[] = await getPriceFiles(d);

  // Now, let's see if we can find this series, year, and variety
  const priceList = prices.find((p) => p.name.toLowerCase() === series.toLowerCase());
  if (!priceList) {
    errorCode = `${series} not found`;
  } else {
    // OK, we have it - let's see if we can match the year
    price_as_of = priceList.price_as_of;
    let issues: CoinIssue[] = priceList.issues.filter((i: CoinIssue) => (yearMatch(i.name, year, undefined)));
    if ((issues.length > 1) && details.length) {
      // See if there's an exact match
      const exactMatches: CoinIssue[] = [];

      details.forEach((detail) => {
        issues.forEach((i: CoinIssue) => {
          const name: string = `${year} ${detail}`;
          if (i.name.toLowerCase().trim() === name.toLowerCase().trim()) {
            exactMatches.push(i);
          }
        });
      });

      if (exactMatches.length) {
        issues = exactMatches;
      }
    } else if (!issues.length) {
      // Let's see if we can find a match using the details passed in
      // That might include qualifiers like RB or VDB
      issues = [];
      details.forEach((detail) => {
        if (!issues.length) {
          issues = priceList.issues.filter((i: CoinIssue) => (yearMatch(i.name, year, detail)));
        }
      });
    }
    if (!issues.length) {
      errorCode = `Year ${year} not found in ${priceList.name}`;
    } else {
      // If there is more than one issue that matches, we look at variety
      // Let's see if we can match variety - if not, we'll note and do our best
      let issue: CoinIssue | undefined;
      if (issues.length > 1) {
        if (variety) {
          issue = issues.find((i: CoinIssue) => (i.variety?.toLowerCase() === variety));
        } else {
          issue = issues.find((i: CoinIssue) => !i.variety?.length);
        }
      } else {
        issue = issues[0];
      }

      // Still don't have anything? Then we'll just use the first one
      if (!issue) {
        issue = issues[0];
        errorCode = `Can't find variety ${variety?.length ? variety : "no variety"}, using ${issue.variety?.length ? issue.variety : "no variety"} instead`;
      }

      // OK, now let's see if we have an exact match on the grade
      const coinPrice = issue.prices.find((p: CoinPrice) => p.grade === grade);
      if (coinPrice) {
        // Great, exact match!
        price = coinPrice.price;
      } else {
        // Not an exact match, so we'll extrapolate
        // Find price below and then find price above (or none if not found)
        // Price will be guessed at 1/3 between these price ranges
        const lowerPrices: CoinPrice[] = issue.prices.filter((p: CoinPrice) => p.grade < grade).sort((a, b) => b.grade - a.grade);
        price_below = lowerPrices.length ? lowerPrices[0] : undefined;
        const higherPrices: CoinPrice[] = issue.prices.filter((p: CoinPrice) => p.grade > grade).sort((a, b) => a.grade - b.grade);
        price_above = higherPrices.length ? higherPrices[0] : undefined;

        if (price_below?.price) {
          if (price_above?.price) {
            price = price_below.price + Math.floor((price_above.price - price_below.price) / 3);
          } else {
            // This is unlikely ... we'll just use the below price
            price = price_below.price;
          }
        } else if (price_above?.price) {
          // Nothing graded this low .. just use price above then
          price = price_above.price;
        }
      }
    }
  }

  return { errorCode, price, price_as_of, price_below, price_above };
};
