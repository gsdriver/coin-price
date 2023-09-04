import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { createObjectCsvStringifier as createCsvStringifier } from "csv-writer";
import * as logger from "./logger";
import fs from "fs";

export interface CoinPrice {
  grade: number;
  price: number;
}

export interface CoinIssue {
  name: string; // Eventually will break out year, mintmark, variety
  variety?: string;
  prices: CoinPrice[];
}

export interface CoinSeries {
  name: string;
  issues: CoinIssue[];
  price_as_of: Date;
}

const SERIESFILE = "serieslist.json";

let seriesList: CoinSeries[] | undefined;

const zeroPad = (d: number) => {
  return (`0${d}`).slice(-2);
};

const formatDate = (d: Date | undefined): string => {
  if (!d) {
    return "";
  }

  return `${d.getFullYear()}-${zeroPad(d.getMonth() + 1)}-${zeroPad(d.getDate())}`;
};

const readFromS3 = async (key: string): Promise<string> => {
  let value: any;
  const region = "us-west-2";
  const client = new S3Client({ region });

  try {
    const streamToString = (stream: any) =>
      new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk: any) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });

    const { Body } = await client.send(command);
    value = await streamToString(Body);
  }
  catch (e) {
    logger.info("Error reading from S3", { value });
  }

  return value;
};

export const getPriceFiles = async (date: Date): Promise<CoinSeries[]> => {
  // If it's cached, just return that cached file
  if (seriesList) {
    return seriesList;
  }

  // Loop thru to read in all keys
  let keyList: string[] = [];
  const coinKeys: string[] = [];
  try {
    let data: any;

    const client: any = new S3Client({
      region: "us-west-2",
    });

    await (async function loop(firstRun, token): Promise<any> {
      const params: any = { Bucket: process.env.S3_BUCKET };
      if (firstRun || token) {
        if (token) {
          params.ContinuationToken = token;
        }

        const command = new ListObjectsV2Command(params);
        data = await client.send(command);
        keyList = keyList.concat(data.Contents.map((d: any) => d.Key));
        if (data.NextContinuationToken) {
          return loop(false, data.NextContinuationToken);
        }
      }
    }(true, null));

    // Only keep those before the given date
    keyList = keyList
      .filter((key: string) => {
        if (key === SERIESFILE) {
          return false;
        }

        // Is it before the given date?
        const values = key.split("/");
        const d = new Date(values[0]);
        return d <= date;
      });

    // And keep the most recent of each coin file that passes that filter
    keyList.forEach((k: string) => {
      const coin: string = k.split("/")[1].toLowerCase();
      const j: number = coinKeys.findIndex((x: string) => x.split("/")[1].toLowerCase() === coin);
      if (j > -1) {
        // Already in there
        if (new Date(k.split("/")[0]) > new Date(coinKeys[j].split("/")[0])) {
          coinKeys[j] = k;
        }
      } else {
        // Not there - add it
        coinKeys.push(k);
      }
    });
  } catch (e) {
    // There's an error - clear the keylist and try again later
    logger.error((e as any)?.message, "Problem reading pricing files");
    keyList = [];
  }

  // OK, now we read in each of these files
  let iKey: number;
  seriesList = [];
  for (iKey = 0; iKey < coinKeys.length; iKey++) {
    const dataStr: string = await readFromS3(coinKeys[iKey]);
    const name: string = (coinKeys[iKey].split("/")[1]).split(".csv")[0];
    const coinSeries: CoinSeries = { name, issues: [], price_as_of: new Date(coinKeys[iKey].split("/")[0]) };

    // First line is year, variety, and grade values
    const lines = dataStr.split("\n");
    const header = lines[0].split(",");
    let l: number;
    for (l = 1; l < lines.length; l++) {
      const issue: string[] = lines[l].split(",");
      if (issue.length >= header.length) {
        const coinIssue: CoinIssue = { name: issue[0], variety: issue[1], prices: [] };
        let p: number;
        for (p = 2; p < issue.length; p++) {
          coinIssue.prices.push({ grade: parseInt(header[p], 10), price: parseInt(issue[p], 10) });
        }
        coinSeries.issues.push(coinIssue);
      }
    }
    seriesList.push(coinSeries);
  }

  return seriesList;
};

export const readCoins = async (): Promise<{ year: string, value: string, details?: string, grade: string, variety?: string }[]> => {
  // Local read and parse of coins
  const coins: { year: string, value: string, grade: string, variety?: string }[] = [];

  try {
    const data = fs.readFileSync("mycoins.csv", "utf-8");
    const lines = data.split("\r\n");
    lines.forEach((l) => {
      const values = l.split(",");
      if (values.length >= 4) {
        const coin: { year: string, value: string, details?: string, grade: string, variety?: string } = { year: values[0], value: values[1], details: values[2], grade: values[3] };
        if (values.length >= 5) {
          coin.variety = values[4];
        }
        coins.push(coin);
      }
    });
  } catch (e) {
    logger.error((e as any)?.message, "Can't read coins");
  }

  return coins;
};

export const writeCoinPrices = async (coins: { year: string, value: string, details?: string, grade: string, variety?: string, price: string, price_as_of: Date | undefined, explanation: string }[]): Promise<boolean> => {
  let success: boolean = false;

  const records: string[][] = coins.map((c) => {
    return [ c.year, c.value, c.details || "", c.grade, c.variety || "", c.price, formatDate(c.price_as_of), c.explanation ];
  });

  // Generate a CSV file
  const header: string[] = ["Year", "Value", "Details", "Grade", "Variety", "Price", "As Of", "Notes"];
  const csvStringifier = createCsvStringifier({
    header: header.map((h: string) => ({ id: h, title: h })),
  });

  let i: number;
  const entries: {[s: string]: string}[] = [];
  for (i = 0; i < records.length; i++) {
    const entry: {[s: string]: string} = {};

    records[i].forEach((item, j) => {
      entry[header[j]] = item;
    });
    entries.push(entry);
  }

  const fileText: string = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(entries);
  fs.writeFileSync("myprices.csv", fileText);
  success = true;

  return success;
};
