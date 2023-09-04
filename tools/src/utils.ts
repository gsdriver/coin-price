import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createObjectCsvStringifier as createCsvStringifier } from "csv-writer";
import * as logger from "./logger";

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

const buildGrades = (s: CoinSeries): number[] => {
  // Pull out each unique grade to allow us to put together a header
  const grades: number[] = [];
  s.issues.forEach((i: CoinIssue) => {
    i.prices.forEach((p: CoinPrice) => {
      if (grades.indexOf(p.grade) === -1) {
        grades.push(p.grade);
      }
    });
  });

  return grades.sort((a, b) => a - b);
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

export const getPriceFilesAtDate = async (baseDate: Date): Promise<CoinSeries[]> => {
  // If it's cached, just return that cached file
  if (seriesList) {
    return seriesList;
  }

  // Loop thru to read in all keys
  let keyList: string[] = [];
  try {
    let data: any;

    const client: any = new S3Client({
      region: "us-west-2",
    });

    await (async function loop(firstRun, token): Promise<any> {
      const params: any = { Bucket: process.env.S3_BUCKET, Prefix: `${formatDate(baseDate)}/` };
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
  } catch (e) {
    // There's an error - clear the keylist and try again later
    logger.error((e as any)?.message, "Problem reading pricing files");
    keyList = [];
  }

  // OK, now we read in each of these files
  let iKey: number;
  seriesList = [];
  for (iKey = 0; iKey < keyList.length; iKey++) {
    const dataStr: string = await readFromS3(keyList[iKey]);
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
    seriesList.push(coinSeries);
  }

  return seriesList;
};

export const saveCoinSeries = async (coinSeries: CoinSeries): Promise<boolean> => {
  let success: boolean = false;

  // Generate the key based on the first day of the week
  const d: Date = new Date();
  d.setDate(d.getDate() - d.getDay());
  const keyPrefix: string = `${d.getFullYear()}-${zeroPad(d.getMonth() + 1)}-${zeroPad(d.getDate())}`;

  try {
    const records: string[][] = [];

    // Pull out each unique grade to allow us to put together a header
    const grades: number[] = buildGrades(coinSeries);

    // Now go through the entire structure and put together our price rows
    const headers = [ "Year", "Variety" ].concat(grades.map((g: number) => g.toString()));
    records.push(headers);
    coinSeries.issues.forEach((issue: CoinIssue) => {
      const row = [ issue.name, issue.variety || "" ];
      grades.forEach((grade: number) => {
        const price = issue.prices.find((p: CoinPrice) => p.grade === grade);
        row.push(price?.price?.toString() || "");
      });
      records.push(row);
    });

    // Generate a CSV file
    const csvStringifier = createCsvStringifier({
      header: records[0].map((h: string) => ({ id: h, title: h })),
    });

    let i: number;
    const entries: {[s: string]: string}[] = [];
    for (i = 1; i < records.length; i++) {
      const entry: {[s: string]: string} = {};

      records[i].forEach((item, j) => {
        entry[records[0][j]] = item;
      });
      entries.push(entry);
    }

    const fileText: string = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(entries);

    // Now save to S3
    const client: S3Client = new S3Client({
      region: "us-west-2",
    });

    const command = new PutObjectCommand({
      Body: fileText,
      Bucket: process.env.S3_BUCKET,
      Key: `${keyPrefix}/${coinSeries.name}.csv`,
    });
    await client.send(command);

    success = true;
  }
  catch (e) {
    logger.error((e as any)?.message, "Problem saving to s3");
  }

  return success;
};
