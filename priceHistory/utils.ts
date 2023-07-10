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

export const formatMonth = (d: Date): string => {
  return `${zeroPad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
};

export const formatPrice = (deposit_amount: number) => {
  const commaNumber = (x: number) => {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  const dollars = Math.floor(deposit_amount / 100);
  const cents = deposit_amount % 100;
  if (cents) {
    return `$${commaNumber(dollars)}.${(`0${cents}`).slice(-2)}`;
  }

  return `$${commaNumber(dollars)}`;

};