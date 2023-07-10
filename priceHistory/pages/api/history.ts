import * as express from "express";
import * as logger from "@/logger";
import { CoinPrice } from "@/utils";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand, QueryCommandInput, ScanCommand, ScanCommandInput, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

interface Result {
  statusCode: number;
  errorCode?: string;
  history?: CoinPrice[];
}

const formatIssue = (issue: string | undefined): string | undefined => {
  if (!issue) {
    return undefined;
  }

  // We need to split out year and mintmark, capitalizing the mintmark
  // Note we only want to capitalize mintmarks, not other details
  const mintmarks: string[] = ["d", "p", "s", "o", "c", "cc", "w"];
  // Capitalize the mintmark and put a space in between
  return issue.split(/[ ,-]+/).map((s: string) => {
    if (mintmarks.includes(s.toLowerCase())) {
      return s.toUpperCase();
    } else {
      return s;
    }
  }).join(" ");
};

const priceCoin = (prices: CoinPrice[], grade: number): number => {
  let price: number = 0;
  let price_below: CoinPrice | undefined;
  let price_above: CoinPrice | undefined;

  // OK, now let's see if we have an exact match on the grade
  const coinPrice = prices.find((p: CoinPrice) => p.grade === grade);
  if (coinPrice) {
    // Great, exact match!
    price = coinPrice.price;
  } else {
    // Not an exact match, so we'll extrapolate
    // Find price below and then find price above (or none if not found)
    // Price will be guessed at 1/3 between these price ranges
    const lowerPrices: CoinPrice[] = prices.filter((p: CoinPrice) => p.grade < grade).sort((a, b) => b.grade - a.grade);
    price_below = lowerPrices.length ? lowerPrices[0] : undefined;
    const higherPrices: CoinPrice[] = prices.filter((p: CoinPrice) => p.grade > grade).sort((a, b) => a.grade - b.grade);
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

  return price;
};

// Reads in a price history for the given coin series, issue, and variety
// If no exact match on the variety is found, we will attempt to find a match
// ignoring the variety if the caller allows a DB scan
const readPriceHistory = async (series: string, issue: string, variety: string | undefined, grade: number, allowScan: boolean): Promise<CoinPrice[]> => {
  const history: CoinPrice[] = [];

  // Let's read this in from DynamoDB
  const params: QueryCommandInput = {
    TableName: process.env.DYNAMODB_TABLE,
    KeyConditionExpression: "coin = :coin",
    ExpressionAttributeValues: {
      ":coin": `${series}|${issue}${variety ? `|${variety}` : ""}`,
    },
  };

  // Read items from DynamoDB
  try {
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    const command = new QueryCommand(params);
    let results = await docClient.send(command);

    if (!results.Items?.length && allowScan) {
      // There was no match - let's see if we can find a key ignoring the variety
      const scanParams: ScanCommandInput = {
        TableName: process.env.DYNAMODB_TABLE,
        FilterExpression: "begins_with(coin, :coin)",
        ExpressionAttributeValues: {
          ":coin": `${series}|${issue}`,
        },
      };

      results = await docClient.send(new ScanCommand(scanParams));
    }

    results.Items?.forEach((item: any) => {
      const priceObj = JSON.parse(item.prices);
      const prices: CoinPrice[] = [];
      const price_as_of: Date = new Date(item.price_as_of);

      Object.keys(priceObj).forEach((key: string) => {
        prices.push({ price_as_of, grade: parseInt(key, 10), price: priceObj[key] });
      });

      const price: number = priceCoin(prices, grade);
      history.push({ price_as_of, grade, price });
    });
  } catch (e) {
    logger.info("Error querying info from DynamoDB", { series, issue, variety, params });
    logger.error((e as any)?.message, "Error reading from DynamoDB");
  }

  // Sort the history by date
  history.sort((a: CoinPrice, b: CoinPrice) => {
    return a.price_as_of.getTime() - b.price_as_of.getTime();
  });

  return history;
};

export default async (req: express.Request, res: express.Response) => {
  try {
    logger.info("Received request", { method: req.method, body: req.body, query: req.query });

    if (req.method === "GET") {
      let result: Result = { statusCode: 500, errorCode: "INTERNALERROR" };

      try {
        // Read in the coin details, as well as whether we are allowed to scan
        const allowScan: boolean = !!req.query.allowScan;
        const series: string | undefined = req.query.series as string;
        const issue: string | undefined = formatIssue(req.query.issue as string);
        const grade: number = parseInt(req.query.grade as string, 10);
        const variety: string | undefined = req.query.variety as string;

        if (!series || !issue || !grade || isNaN(grade)) {
          // Invalid parmeters - don't process this request!
          result = {
            statusCode: 400,
            errorCode: "INVALIDPARAMETER",
          };
        } else {
          // OK, get the history of prices for this coin
          const history = await readPriceHistory(series, issue, variety, grade, allowScan);

          // Now, we need to filter the history to only return dates where the price changes
          let lastPrice: number = 0;
          result.history = [];
          history.forEach((price: CoinPrice) => {
            if (price.price !== lastPrice) {
              lastPrice = price.price;
              result.history?.push({ price_as_of: price.price_as_of, grade, price: price.price });
            }
          });

          // All done!
          result.statusCode = 200;
        }
      } catch (e) {
        logger.error(e as Error, "Get price history returned error");
        result.statusCode = 500;
        result.errorCode = "INTERNALERROR";
      }

      // We'll report success if we have some scores
      res.statusCode = result.statusCode;
      res.json({
        success: (result.statusCode === 200),
        errorCode: (result.statusCode === 200) ? undefined : result.errorCode,
        history: (result.statusCode === 200) ? result.history : undefined,
      });

      return;
    }
  } catch (e) {
    logger.error((e as any)?.message);
  }

  // Anything else is a failure
  res.statusCode = 400;
  res.end();
};
