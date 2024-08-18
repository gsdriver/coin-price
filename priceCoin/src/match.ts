
const coinSeries: { series: string, value?: string, proof?: boolean, start: string, end?: string }[] = [
  { series: "1 Gold", value: "G$1", start: "1849", end: "1889" },
  { series: "Proof 1 Gold", value: "G$1", proof: true, start: "1854", end: "1889" },
  { series: "2 Gold", value: "250", start: "1796", end: "1907" },
  { series: "Proof 2 Gold", value: "250", proof: true, start: "1821", end: "1907" },
  { series: "2 Indians", value: "250", start: "1908", end: "1929" },
  { series: "3 Gold", value: "300", start: "1854", end: "1889" },
  { series: "Proof 3 Gold", value: "300", proof: true, start: "1854", end: "1889" },
  { series: "4 Gold Stellas", value: "400", start: "1879", end: "1880" },
  { series: "5 Gold", value: "500", start: "1795", end: "1908" },
  { series: "Proof 5 Gold", value: "500", proof: true, start: "1829", end: "1907" },
  { series: "5 Indians", value: "500", start: "1908", end: "1929" },
  { series: "10 Gold", value: "1000", start: "1795", end: "1907" },
  { series: "Proof 10 Gold", value: "1000", proof: true, start: "1804", end: "1907" },
  { series: "10 Indians", value: "1000", start: "1907", end: "1933" },
  { series: "20 Gold", value: "2000", start: "1849", end: "1907" },
  { series: "Proof 20 Gold", value: "2000", proof: true, start: "1859", end: "1907" },
  { series: "20 St Gaudens", value: "2000", start: "1907", end: "1932" },
  { series: "Early Dollars", value: "S$1", start: "1794", end: "1804" },
  { series: "Liberty Seated Dollars", value: "S$1", start: "1836", end: "1873" },
  { series: "Trade Dollars", value: "S$1", start: "1873", end: "1885" },
  { series: "Morgan Dollars", value: "S$1", start: "1878", end: "1921" },
  { series: "Proof Morgan Dollars", value: "S$1", proof: true, start: "1878", end: "1921" },
  { series: "Proof Like Morgan Dollars", value: "S$1", proof: true, start: "1878", end: "1921" },
  { series: "DMPL Morgan Dollars", value: "S$1", proof: true, start: "1878", end: "1921" },
  { series: "GSA Morgan Dollars", value: "S$1", proof: true, start: "1878", end: "1891" },
  { series: "Peace Dollars", value: "S$1", start: "1921", end: "1935" },
  { series: "Eisenhower Dollars", value: "S$1", start: "1971", end: "1978" },
  { series: "Susan B Anthony Dollars", value: "S$1", start: "1979", end: "1999" },
  { series: "Sacagawea Dollars", value: "S$1", start: "2000" },
  { series: "Presidential Dollars", value: "S$1", start: "2007" },
  { series: "Early Halves", value: "50", start: "1794", end: "1807" },
  { series: "Bust Halves", value: "50", start: "1807", end: "1839" },
  { series: "Liberty Seated Halves", value: "50", start: "1839", end: "1891" },
  { series: "Proof Liberty Seated Halves", value: "50", proof: true, start: "1839", end: "1891" },
  { series: "Barber Halves", value: "50", start: "1892", end: "1915" },
  { series: "Proof Barber Halves", value: "50", proof: true, start: "1892", end: "1915" },
  { series: "Walking Liberty Halves", value: "50", start: "1916", end: "1947" },
  { series: "Proof WalkingLiberty Halves", value: "50", proof: true, start: "1936", end: "1942" },
  { series: "Franklin Halves", value: "50", start: "1948", end: "1963" },
  {
    series: "Full Bell LinesFranklin Halves",
    value: "50",
    start: "1948",
    end: "1963"
  },
  { series: "Proof Franklin Halves", value: "50", proof: true, start: "1950", end: "1963" },
  { series: "Kennedy Halves", value: "50", start: "1964" },
  { series: "Bust Quarters", value: "25", start: "1796", end: "1838" },
  { series: "Liberty Seated Quarters", value: "25", start: "1838", end: "1891" },
  {
    series: "Proof LibertySeated Quarters",
    value: "25",
    proof: true,
    start: "1842",
    end: "1891"
  },
  { series: "Barber Quarters", value: "25", start: "1892", end: "1916" },
  { series: "Proof Barber Quarters", value: "25", proof: true, start: "1892", end: "1915" },
  { series: "Standing Liberty Quarters", value: "25", start: "1916", end: "1930" },
  {
    series: "Full Head StandingLiberty Quarters",
    value: "25",
    start: "1916",
    end: "1930"
  },
  { series: "Washington Quarters", value: "25", start: "1932" },
  { series: "Proof WashingtonQuarters", value: "25", proof: true, start: "1936" },
  { series: "Bust Dimes", value: "10", start: "1796", end: "1837" },
  { series: "Liberty Seated Dimes", value: "10", start: "1837", end: "1891" },
  { series: "Proof Liberty Seated Dimes", value: "10", proof: true, start: "1837", end: "1891" },
  { series: "Barber Dimes", value: "10", start: "1892", end: "1916" },
  { series: "Proof Barber Dimes", value: "10", proof: true, start: "1892", end: "1915" },
  { series: "Mercury Dimes", value: "10", start: "1916", end: "1945" },
  { series: "Proof Mercury Dimes", value: "10", proof: true, start: "1936", end: "1942" },
  { series: "Full Band Mercury Dimes", value: "10", start: "1916", end: "1945" },
  { series: "Roosevelt Dimes", value: "10", start: "1946" },
  { series: "Proof Roosevelt Dimes", value: "10", proof: true, start: "1950" },
  {
    series: "Full TorchRoosevelt Dimes",
    value: "10",
    start: "1946",
    end: undefined
  },
  { series: "Shield Nickels", value: "5", start: "1866", end: "1883" },
  { series: "Proof Shield Nickels", value: "5", proof: true, start: "1866", end: "1883" },
  { series: "Liberty Nickels", value: "5", start: "1883", end: "1913" },
  { series: "Proof Liberty Nickels", value: "5", proof: true, start: "1883", end: "1913" },
  { series: "Buffalo Nickels", value: "5", start: "1913", end: "1938" },
  { series: "Proof Buffalo Nickels", value: "5", proof: true, start: "1913", end: "1937" },
  { series: "Jefferson Nickels", value: "5", start: "1938" },
  { series: "Proof Jefferson Nickels", value: "5", proof: true, start: "1938" },
  {
    series: "Full StepJefferson Nickels",
    value: "5",
    start: "1938",
    end: undefined
  },
  { series: "Large Cents", value: "1", start: "1793", end: "1857" },
  { series: "Flying Eagle Cents", value: "1", start: "1856", end: "1858" },
  { series: "Indian Cents", value: "1", start: "1859", end: "1909" },
  { series: "Proof Indian Cents", value: "1", proof: true, start: "1859", end: "1909" },
  { series: "Lincoln Cents", value: "1", start: "1909", end: "1933" },
  { series: "Modern Lincoln Cents", value: "1", start: "1934" },
  { series: "Proof Lincoln Cents", value: "1", proof: true, start: "1909" },
  { series: "Silver Commemoratives", start: "1892", end: "1954" },
  { series: "Gold Commemoratives", start: "1903", end: "1926" },
  { series: "Modern CommemsHalves", start: "1982" },
  { series: "Modern CommemsDollars", start: "1983" },
  { series: "Modern Commems5 Gold", start: "1986" },
  { series: "Modern Commems10 Gold", start: "1984" },
  { series: "Half Cents", value: "0.5", start: "1793", end: "1857" },
  { series: "Two Cents", value: "2", start: "1864", end: "1872" },
  { series: "Proof Two Cents", value: "2", proof: true, start: "1864", end: "1873" },
  { series: "Three Cents Silver", value: "3", start: "1851", end: "1872" },
  { series: "Proof Three Cents Silver", value: "3", proof: true, start: "1854", end: "1873" },
  { series: "Three Cents Nickel", value: "3", start: "1865", end: "1889" },
  { series: "Proof Three Cents Nickel", value: "3", proof: true, start: "1865", end: "1889" },
  { series: "Half Dimes", value: "5", start: "1794", end: "1873" },
  { series: "Twenty Cents", value: "20", start: "1875", end: "1878" },
  { series: "Modern Eagles", start: "1986" },
  { series: "Modern Buffaloes", start: "2006" },
  {
    series: "America the BeautifulSilver",
    start: "2010",
    end: undefined
  },
  { series: "Signature Series", start: "1983" },
  { series: "Proof Sets", value: "Proof Set", start: "1936", proof: true },
];

export const lookupSeries = (year: string, value: string, proof: boolean): string[] | undefined => {
  // Just pull out the year, no mintmarks
  const arr = year.match(/([\s\S]*)(\d*)([\s\S]*)/);
  let y: number = 0;
  if (arr?.length && arr.length > 1) {
    y = parseInt(arr[1], 10);
  }

  const values = coinSeries.filter((s: any) => {
    if (s.value !== value) {
      return false;
    }
    if ((proof && !s.proof) || (!proof && s.proof)) {
      return false;
    }

    const start = parseInt(s.start, 10);
    const end = s.end ? parseInt(s.end, 10) : (new Date()).getFullYear() + 1;
    return (y >= start) && (y <= end);
  });

  return values.length ? values.map(v => v.series) : undefined;
};
