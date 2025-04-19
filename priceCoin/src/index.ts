/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* tslint:disable-next-line */
const config = require("dotenv").config();
import * as logger from "./logger";
import { priceOneCoin } from "./price";
import { readCoins, writeCoinPrices } from "./utils";

exports.handler = async (event: any) => {
  // You need to supply a series, year, and grade at minimum
  logger.info("received event", { event });

  const coins = await readCoins();
  const pricedCoins: { year: string, value: string, grade: string, variety?: string, price: string, price_as_of: Date | undefined, explanation: string }[] = [];

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

    const result: { price: string, price_as_of: Date | undefined, explanation: string } = await priceOneCoin(coin, event?.date);
    pricedCoins.push({ ...coin, ...result });
  }

  // Now let's write the result out
  await writeCoinPrices(pricedCoins);

  return pricedCoins;
};
