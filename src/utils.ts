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

let seriesList: { [s: string]: CoinSeries[] } | undefined;

// This function must be called first, to initialize the seriesList structure
export const loadPriceFiles = async(event: any): Promise<boolean> => {
  // Loop thru to read in all keys
  let keyList: string[] = [];
  let step: number;

  // If we've already loaded the list, the return
  if (seriesList) {
    return true;
  }

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

    // Ignore the series file
    keyList = keyList.filter((key: string) => key !== SERIESFILE);
  } catch (e) {
    // There's an error - clear the keylist and try again later
    logger.error((e as any)?.message, "Problem reading pricing files");
    keyList = [];
  }

  // Get a list of the unique dates here
  let dateKeys: string[] = [];
  keyList.forEach((key: string) => {
    const values = key.split("/");
    if (dateKeys.indexOf(values[0]) === -1) {
      dateKeys.push(values[0]);
    }
  });
  dateKeys.sort((a, b) => (new Date(a).valueOf() - (new Date(b).valueOf())));

  // Now, let's figure out which dates make sense to read in
  if (event?.start) {
    const start: Date = new Date(event.start);
    const end: Date = event.end ? new Date(event.end) : new Date();

    if (!event.step) {
      // How many days between start and end?
      const daysBetween = (end.valueOf() - start.valueOf()) / (24 * 60 * 60 * 1000);
      if (daysBetween < 60) {
        step = 7;
      } else if (daysBetween < 180) {
        step = 30;
      } else if (daysBetween < 365) {
        step = 90;
      } else if (daysBetween < 3 * 365) {
        step = 365;
      }
    } else {
      step = event.step;
    }

    // Filter the date list to those between the start and end
    dateKeys = dateKeys.filter((key: string) => ((new Date(key) >= start) && (new Date(key) <= end)));
  } else {
    // Just a single date - so let's find the right date to read
    const age_of_date: Date = event?.date ? new Date(event.date) : new Date();
    let bestDate: string = dateKeys[0];
    dateKeys.forEach((key: string) => {
      if (new Date(bestDate) < age_of_date) {
        bestDate = key;
      }
    });

    dateKeys = [bestDate];
    step = 1;
  }

  // Look at the step to figure out which ones we want to load
  // Step is the number of days for us to place between each entry
  let target: number = 0;
  dateKeys = dateKeys.filter((key: string) => {
    let result: boolean = false;
    const val: number = (new Date(key)).valueOf();
    if ((val - target) >= (step * 24 * 60 * 60 * 1000)) {
      target = target ? target + (step * 24 * 60 * 60 * 1000) : val;
      result = true;
    }

    return result;
  });
  keyList = keyList.filter((key: string) => {
    const values = key.split("/");
    return dateKeys.indexOf(values[0]) > -1;
  });

  // OK, now we read in each of these files
  if (keyList.length) {
    let iKey: number;

    seriesList = {};
    for (iKey = 0; iKey < keyList.length; iKey++) {
      const dataStr: string = await readFromS3(keyList[iKey]);
      const dateStr: string = formatDate(new Date(keyList[iKey].split("/")[0]));
      const name: string = (keyList[iKey].split("/")[1]).split(".csv")[0];
      const coinSeries: CoinSeries = { name, issues: [], price_as_of: new Date(keyList[iKey].split("/")[0]) };

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

      // Add this in
      seriesList[dateStr] = seriesList[dateStr] || [];
      seriesList[dateStr].push(coinSeries);
    }
  }

  return !!seriesList;
};

const zeroPad = (d: number) => {
  return (`0${d}`).slice(-2);
};

export const formatDate = (d: Date | undefined): string => {
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

export const getScrapedDates = async (): Promise<Date[]> => {
  // If it's cached, just return that cached file
  if (!await loadPriceFiles(undefined)) {
    return [];
  }

  return Object.keys(seriesList!).map((d) => new Date(d)).sort((a, b) => a.valueOf() - b.valueOf());
};

export const getPriceFiles = async (date: Date): Promise<CoinSeries[]> => {
  // If it's cached, just return that cached file
  const dateStr: string = formatDate(date);
  if (!await loadPriceFiles(undefined)) {
    return [];
  }

  // OK, look for the closest value before this date
  let bestDate: string | undefined;
  Object.keys(seriesList!).forEach((key) => {
    const d: Date = new Date(key);
    if (d < date) {
      bestDate = (!bestDate || (d > new Date(bestDate))) ? key : bestDate;
    }
  });
  if (!bestDate) {
    // Just pick the earliest available
    Object.keys(seriesList!).forEach((key) => {
      const d: Date = new Date(key);
      bestDate = (!bestDate || (d < new Date(bestDate))) ? key : bestDate;
    });
  }

  if (!bestDate) {
    logger.info("Couldn't find good date to use", { date });
    return [];
  }

  return seriesList![bestDate] || [];
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

export const writeCoinPrices = async (coins: { year: string, value: string, details?: string, grade: string, variety?: string, prices: { [s: string]: string }, explanation: string }[]): Promise<boolean> => {
  let success: boolean = false;

  // Get the set of dates to use
  const dates: string[] = [];
  coins.forEach((coin) => {
    Object.keys(coin.prices).forEach((price) => {
      if (dates.indexOf(price) === -1) {
        dates.push(price);
      }
    });
  });
  dates.sort((a, b) => (new Date(a)).valueOf() - (new Date(b)).valueOf());

  const records: string[][] = coins.map((c) => {
    const record: string[] = [c.year, c.value, c.details || "", c.grade, c.variety || ""];
    dates.forEach((date) => {
      record.push(c.prices[date] || "");
    });

    record.push(c.explanation);
    return record;
  });

  // Generate a CSV file
  let header: string[] = ["Year", "Value", "Details", "Grade", "Variety"];
  header = header.concat(dates);
  header.push("Notes");

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
