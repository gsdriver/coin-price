import * as express from "express";
import * as logger from "@/logger";
import { CoinIssue, CoinSeries, formatDate } from "@/utils";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

interface Result {
  statusCode: number;
  errorCode?: string;
  seriesList?: CoinSeries[];
}

// Singleton client — shared across all requests in this server process
const s3Client = new S3Client({ region: "us-west-2" });

// In-memory cache — populated on first GET, invalidated on PUT
let cachedSeriesList: CoinSeries[] | null = null;

const readFromS3 = async (bucket: string, key: string): Promise<string> => {
  let value: any;

  try {
    const streamToString = (stream: any) =>
      new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk: any) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const { Body } = await s3Client.send(command);
    value = await streamToString(Body);
  } catch (e) {
    logger.info("Error reading from S3", { e, key });
    logger.error((e as any)?.message, `Problem reading from S3 key ${key}`);
  }

  return value;
};

const readSeries = async (key: string): Promise<CoinSeries> => {
  const series: CoinSeries = { name: "", issues: [] };
  series.name = (key.split("/")[1]).split(".csv")[0];

  try {
    const value: string = await readFromS3(process.env.S3_BUCKET!, key);

    const lines = value.split("\n");
    lines.forEach((line: string) => {
      const issue = line.split(",");
      if ((issue.length >= 2) && (issue[0] !== "Year")) {
        const coinIssue: CoinIssue = { name: issue[0] };
        if (issue[1].length > 0) {
          coinIssue.variety = issue[1];
        }
        series.issues.push(coinIssue);
      }
    });
  } catch (e) {
    logger.error((e as any)?.message, `Problem reading series ${key}`);
    series.issues = [];
  }

  return series;
};

const reloadPriceFiles = async(date: Date): Promise<CoinSeries[]> => {
  let seriesList: CoinSeries[] = [];
  let keyList: string[] = [];
  let i: number;

  try {
    let data: any;

    await (async function loop(firstRun, token): Promise<any> {
      const params: any = {
        Bucket: process.env.S3_BUCKET,
        Prefix: `${formatDate(date)}`,
      };

      if (firstRun || token) {
        if (token) {
          params.ContinuationToken = token;
        }

        const command = new ListObjectsV2Command(params);
        data = await s3Client.send(command);
        keyList = keyList.concat(data.Contents.map((d: any) => d.Key));
        if (data.NextContinuationToken) {
          return loop(false, data.NextContinuationToken);
        }
      }
    }(true, null));

    for (i = 0; i < keyList.length; i++) {
      seriesList = seriesList.concat(await readSeries(keyList[i]));
    }

    const command = new PutObjectCommand({
      Body: JSON.stringify({ date, seriesList }),
      Bucket: process.env.S3_CONFIG_BUCKET,
      Key: "coin-price-history/seriesList.json",
    });
    await s3Client.send(command);
  } catch (e) {
    logger.error((e as any)?.message, "Problem reading pricing files");
    keyList = [];
  }

  return seriesList;
};

const loadPriceFiles = async(): Promise<CoinSeries[]> => {
  const value = await readFromS3(process.env.S3_CONFIG_BUCKET!, "coin-price-history/seriesList.json");
  return JSON.parse(value).seriesList;
};

export default async (req: express.Request, res: express.Response) => {
  try {
    logger.info("Received request", { method: req.method, body: req.body, query: req.query });

    if (req.method === "GET") {
      let result: Result = { statusCode: 500, errorCode: "INTERNALERROR" };

      try {
        if (!cachedSeriesList) {
          cachedSeriesList = await loadPriceFiles();
        }
        result.seriesList = cachedSeriesList;
        result.statusCode = 200;
      } catch (e) {
        logger.error(e as Error, "Read series list returned error");
        result.statusCode = 500;
        result.errorCode = "INTERNALERROR";
      }

      res.statusCode = result.statusCode;
      if (result.statusCode === 200) {
        res.setHeader('Cache-Control', 'private, max-age=3600');
      }
      res.json({
        success: (result.statusCode === 200),
        errorCode: (result.statusCode === 200) ? undefined : result.errorCode,
        seriesList: (result.statusCode === 200) ? result.seriesList : undefined,
      });

      return;
    } else if (req.method === "PUT") {
      const d: Date = new Date();
      d.setDate(d.getDate() - d.getDay() - 7);

      cachedSeriesList = null; // invalidate so next GET re-fetches from S3
      await reloadPriceFiles(d);
      res.statusCode = 200;
      res.json({
        success: true,
      });

      return;
    }
  } catch (e) {
    logger.error((e as any)?.message);
  }

  res.statusCode = 400;
  res.end();
};
