import * as logger from "./logger";
import { CoinIssue, CoinPrice, CoinSeries, getPriceFiles } from "./utils";
import { lookupSeries } from "./match";

// This function presumes that the given mark is lower-cased
const isMintMark = (mark: string) : boolean => ["p", "d", "s", "w", "c", "o", "cc"].indexOf(mark) > -1;

const getYearAndMintMark = (year: string): string => {
  const components = year.toLowerCase().split(/[ ,-]+/);
  // If missing mintmark, then put on "p" for Philadelphia
  let mintMark: string = "p";

  if (components.length > 1) {
    if (isMintMark(components[1])) {
      mintMark = components[1];
    }
  }

  return `${components[0]}-${mintMark}`;
};

// Checks whether the details from a comparison coin are a match for the given coin and vice versa
// This helps us determine how close a match these two coins are - the higher the number the better
// 0 - Both have different details
// 1 - One has details but the other doesn't
// 2 - Both have details and one is a substring of the other
// 3 - Both have details (or both don't have details) and they are an exact match
const detailMatchScore = (comparisonCoin: string, details: string): number => {
  // Get the details from the comparison coin
  let components = comparisonCoin.toLowerCase().split(/[ ,-]+/);
  components = ((components.length > 1) && isMintMark(components[1])) ? components.slice(2) : components.slice(1);
  const componentDetails = components.join(" ").toLowerCase();
  const givenDetails = details.toLowerCase();

  // OK, start at the top - do both have the same details (this includes empty string)
  if (componentDetails === givenDetails) {
    return 3;
  }
  // Do both have details and one is a substring of the other?
  if (componentDetails.length && givenDetails.length && (componentDetails.indexOf(details) > -1 || details.indexOf(componentDetails) > -1)) {
    return 2;
  }
  // Does one have details but the other doesn't?
  if ((!componentDetails.length && givenDetails.length) || (componentDetails.length && !givenDetails.length)) {
    return 1;
  }

  // OK, these are different details so bail
  return 0;
};

const findBestMatch = (series: CoinSeries, coin: { year: string, variety: string | undefined, details: string } ): { issue: CoinIssue | undefined, errorCode: string | undefined } => {
  let match: CoinIssue | undefined;
  let errorCode: string | undefined;

  // Prep work - make sure the year we're comparing against is in the right format, lower-cased and with "p" added if necessary
  const yearToFind = getYearAndMintMark(coin.year);

  // First, we'll look at the year/mintmark to see the subset of coin issues for consideration
  let issues: CoinIssue[] = series.issues.filter((issue: CoinIssue) => getYearAndMintMark(issue.name) === yearToFind);

  if (!issues.length) {
    errorCode = `Year ${coin.year} not found in ${series.name}`;
  // If just one match, use it
  } else if (issues.length === 1) {
    match = issues[0];
  }
  // If multiple matches, look at variety and details to see if we can refine the match
  else if (issues.length > 1) {
    // Look at variety first - if there are matches on variety, we'll consider those
    if (coin.variety?.length) {
      // If there are any issues that match this variety, then we'll filter to only include those issues
      const variety = coin.variety.toLowerCase();
      const matchingVarietyIssues = issues.filter((issue: CoinIssue) => issue.variety?.toLowerCase() === variety);
      if (matchingVarietyIssues.length) {
        issues = matchingVarietyIssues;
      }
    }

    if (issues.length > 1) {
      // Look at details - we're going to see how many details from the coin are in the issue name and vice versa
      // We'll do this in two passes - it's a small array
      let maxScore: number = 0;
      issues.forEach((issue: CoinIssue) => {
        const max = detailMatchScore(issue.name, coin.details);
        if (max > maxScore) {
          maxScore = max;
        }
      });

      issues = issues.filter((issue: CoinIssue) => detailMatchScore(issue.name, coin.details) === maxScore);
    }

    // If still multiple choices, pick the cheapest issue (in MS-60) as a match
    if (issues.length > 1) {
      const minPrice = issues.reduce((min, issue) => Math.min(min, issue.prices.find((price) => price.grade === 60)?.price ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
      match = issues.find((issue) => issue.prices.find((price) => price.grade === 60)?.price ?? Number.MAX_SAFE_INTEGER === minPrice) ?? issues[0];
      
      // We need to pick from a set of options - let's set an error code
      errorCode = `Can't find exact match on ${coin.year}${coin.variety ? ` ${coin.variety} ` : ""} ${coin.details} within ${series.name}, using ${match.name}${match.variety ? ` ${match.variety}` : ""} instead`;
    } else {
      // Cool, we got one!
      match = issues[0];
    }
  }

  return { errorCode, issue: match };
};

const priceCoin = async (series: string, year: string, variety: string | undefined, grade: number, date: Date | undefined, details: string):
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
    // OK, we have it - now find the best match for this coin within the series
    price_as_of = priceList.price_as_of;
    const match = findBestMatch(priceList, { year, variety, details });
    errorCode = match.errorCode;
    const issue = match.issue;

    if (issue) {
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

const formatPrice = (price: number): string => {
  const zeroPad = (d: number) => {
    return (`0${d}`).slice(-2);
  };

  return `$${Math.floor(price / 100)}.${zeroPad(price % 100)}`;
};

// Prices one coin, returning two values - a price (as a string) and an explanation
export const priceOneCoin = async (
  coin: {
    series: string | undefined,
    grade: string,
    details: string | undefined,
    year: string,
    variety?: string,
    value: string,
  },
  as_of: Date | undefined): Promise<{ price: string, price_as_of: Date | undefined, explanation: string }> => {
  // Let's transform the grade - we will only take the numeric designation
  // and an indication of whether it is proof
  // That means we'll lose any "+" designation for now
  let price: string | undefined;
  let price_as_of: Date | undefined;
  let explanation: string | undefined;
  let grade: number = parseInt(coin.grade.replace(/[^0-9]+/g, ""), 10);
  const proof: boolean = coin.grade.toLowerCase().indexOf("pr") > -1;
  if (isNaN(grade) && proof) {
    // We'll count this as a PR-60 for now
    grade = 60;
  }

  // Details might be an array including the series name (i.e. 1909 VDB|Lincoln Cent)
  let detailValues = (coin.details || "").split("|").map((d) => d.trim());
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
    // Remove the series name from detailValues in case it's present there
    detailValues = detailValues.filter((v) => v !== series);

    // If there is still more than one detail left, then the first one will be considered the variety
    let details: string = "";
    if (detailValues.length > 1) {
      coin.variety = detailValues[0];
      details = detailValues[1];
      logger.info("Found variety", { details, variety: coin.variety });
    } else if (detailValues.length > 0) {
      details = detailValues[0];
    }

    // Read price files
    const date = (as_of ? new Date(as_of) : new Date());
    const coinPrice = await priceCoin(series, coin.year, coin.variety, grade, date, details);
    if (coinPrice.price) {
      price = formatPrice(coinPrice.price);
      price_as_of = coinPrice.price_as_of;

      // If this was not an exact price, then let's note that in the explanation
      if (coinPrice.price_below || coinPrice.price_above) {
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

    if (coinPrice.errorCode) {
      explanation = `${coinPrice.errorCode}. ${explanation || ""}`.trim();
    }
  }

  return { price: price || "", price_as_of, explanation: explanation || "" };
};
