import { CoinSeries, getPriceFilesAtDate, saveCoinSeries } from "./utils";
import * as logger from "./logger";

const correctYears = async () => {
  const datesToCorrect = [ new Date("2023-08-07"), new Date("2023-08-14"), new Date("2023-08-21"), new Date("2023-08-28") ];

  // First, read in a known good file
  const seriesList = await getPriceFilesAtDate(new Date("2023-07-17"));

  // Now, read in the files we want to correct
  let i: number;
  let j: number;
  let listToCorrect: CoinSeries[] = [];
  for (i = 0; i < datesToCorrect.length; i++) {
    listToCorrect = listToCorrect.concat(await getPriceFilesAtDate(datesToCorrect[i]));
  }

  for (i = 0; i < listToCorrect.length; i++) {
    const coinSeries: CoinSeries = listToCorrect[i];

    // Find this series on the known good list
    const knownGoodSeries = seriesList.find((s: CoinSeries) => s.name === coinSeries.name);
    if (knownGoodSeries && (knownGoodSeries.issues.length === coinSeries.issues.length)) {
      // OK, now we need to correct each issue
      for (j = 0; j < knownGoodSeries.issues.length; j++) {
        coinSeries.issues[j].name = knownGoodSeries.issues[j].name;
      }

      // Now, write this file back to S3
      await saveCoinSeries(coinSeries);
    }
  }
};

correctYears();
