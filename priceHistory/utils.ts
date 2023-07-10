export interface CoinPrice {
  price_as_of: Date;
  grade: number;
  price: number;
}

export interface CoinIssue {
  name: string; // Eventually will break out year, mintmark, variety
  variety?: string;
}

export interface CoinSeries {
  name: string;
  issues: CoinIssue[];
}

const zeroPad = (d: number) => {
  return (`0${d}`).slice(-2);
};

export const formatDate = (d: Date): string => {
  return `${d.getUTCFullYear()}-${zeroPad(d.getUTCMonth() + 1)}-${zeroPad(d.getUTCDate())}`;
};
