"use client"

import { useEffect, useState } from "react";
import fetch from "node-fetch";
import querystring from "querystring";
import Image from "next/image";
import { CoinIssue, CoinSeries } from "@/utils";
import { PriceChart } from "@/components/PriceChart";

const NOVARIETY = "No variety";
const grades: number[] = [1, 2, 3, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 53, 55, 58, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70];

const loadSeriesList = async (): Promise<CoinSeries[]> => {
  let results: any;

  try {
    const resp: any = await fetch("/api/series/list", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await resp.json();
    if (result.success) {
      results = result.seriesList;
    } else {
      results = [];
    }
  } catch (e) {
    // Guess we can't find a series?
    results = [];
  }

  return results;
};

const getCoinHistory = async (series: string, issue: string, grade: number, variety: string | undefined) => {
  let results: any;

  try {
    const resp: any = await fetch(`/api/history?${querystring.stringify({
      series, issue, grade, variety,
    })}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await resp.json();
    if (result.success) {
      results = result.history;
    } else {
      results = [];
    }
  } catch (e) {
    // Guess we can't find this coin?
    results = [];
  }

  return results;
};

export default function Home() {
  const [priceHistory, setPriceHistory] = useState<{price_as_of: string, grade: number, price: number}[]>();
  const [seriesList, setSeriesList] = useState<CoinSeries[]>([]);
  const [issueList, setIssueList] = useState<CoinIssue[]>([]);
  const [varietyList, setVarietyList] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string | undefined>();
  const [selectedIssue, setSelectedIssue] = useState<string | undefined>();
  const [selectedVariety, setSelectedVariety] = useState<string | undefined>();
  const [selectedGrade, setSelectedGrade] = useState<number | undefined>();

  useEffect(() => {
    const initialize = async () => {
      setSeriesList(await loadSeriesList());
      setSelectedSeries(undefined);
      setSelectedIssue(undefined);
      setSelectedVariety(undefined);
      setSelectedGrade(undefined);
      setPriceHistory(undefined);
    };

    initialize();
  }, []);

  const setSeries = (event: any) => {
    setSelectedSeries(event.target.value);
    setSelectedIssue(undefined);
    setSelectedVariety(undefined);
    setSelectedGrade(undefined);
    setPriceHistory(undefined);

    setIssueList(seriesList
      .find((series) => series.name === event.target.value)!.issues
      .filter((issue, idx, arr) => arr.indexOf(issue) === idx));
    setVarietyList([]);
  };

  const setIssue = (event: any) => {
    setSelectedIssue(event.target.value);
    setSelectedGrade(undefined);
    setPriceHistory(undefined);

    const varities = issueList
      .filter((issue) => issue.name === event.target.value)
      .map((issue) => issue.variety || NOVARIETY)
      .filter((variety, idx, arr) => arr.indexOf(variety) === idx);

    setVarietyList(varities);
    setSelectedVariety((varities.length === 1) ? varities[0] : undefined);
  };

  const setVariety = (event: any) => {
    setSelectedVariety(event.target.value);
    setSelectedGrade(undefined);
    setPriceHistory(undefined);
  };

  const setGrade = (event: any) => {
    setSelectedGrade(event.target.value);
    setPriceHistory(undefined);
  }

  const onClickButton = async () => {
    const v: string | undefined = (selectedVariety === NOVARIETY) ? undefined : selectedVariety;

    setPriceHistory(await getCoinHistory(selectedSeries!, selectedIssue!, selectedGrade!, v));
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          <label htmlFor="series">Choose a coin series:</label>
          <select name="series" id="series" value={selectedSeries} onChange={setSeries}>
            {seriesList.map((series) => (
              <option key={series.name} value={series.name}>{series.name}</option>
            ))}
          </select>
        </p>
        {!!selectedSeries && (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
            <label htmlFor="issue">Choose a coin issue:</label>
            <select name="issue" id="issue" value={selectedIssue} onChange={setIssue}>
              {issueList.map((issue) => (
                <option key={issue.name} value={issue.name} selected={issue.name === selectedIssue}>{issue.name}</option>
              ))}
            </select>
          </p>
        )}
        {!!selectedIssue && (varietyList?.length > 1) && (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
            <label htmlFor="variety">Choose a coin variety:</label>
            <select name="variety" id="variety" value={selectedVariety} onChange={setVariety}>
              {varietyList.map((variety) => (
                <option key={variety} value={variety}>{variety}</option>
              ))}
            </select>
          </p>
        )}
        {!!selectedVariety && (
          <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
            <label htmlFor="variety">Choose a grade:</label>
            <select name="grade" id="grade" value={selectedGrade} onChange={setGrade}>
              {grades.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </p>
        )}
      </div>

      <PriceChart
        priceHistory={priceHistory}
        series={selectedSeries}
        issue={selectedIssue}
        variety={selectedVariety}
        grade={selectedGrade}
      />

      <div className="mb-32 grid text-center lg:mb-0 lg:grid-cols-4 lg:text-left">
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full" 
          disabled={!selectedSeries || !selectedIssue || !selectedVariety || !selectedGrade} 
          onClick={onClickButton}>
          Get Price History
        </button>
      </div>
    </main>
  )
}
