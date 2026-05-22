"use client"

import { useEffect, useState } from "react";
import fetch from "node-fetch";
import querystring from "querystring";
import { CoinIssue, CoinSeries } from "@/utils";
import { PriceChart } from "@/components/PriceChart";

const NOVARIETY = "No variety";
const grades: number[] = [1, 2, 3, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 53, 55, 58, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70];

const loadSeriesList = async (): Promise<CoinSeries[]> => {
  try {
    const resp: any = await fetch("/api/series/list", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const result = await resp.json();
    return result.success ? result.seriesList : [];
  } catch {
    return [];
  }
};

const getCoinHistory = async (series: string, issue: string, grade: number, variety: string | undefined) => {
  try {
    const resp: any = await fetch(`/api/history?${querystring.stringify({ series, issue, grade, variety })}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const result = await resp.json();
    return result.success ? result.history : [];
  } catch {
    return [];
  }
};

export default function Home() {
  const [priceHistory, setPriceHistory] = useState<{price_as_of: string, grade: number, price: number}[]>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSeriesLoading, setIsSeriesLoading] = useState(true);
  const [seriesList, setSeriesList] = useState<CoinSeries[]>([]);
  const [issueList, setIssueList] = useState<CoinIssue[]>([]);
  const [varietyList, setVarietyList] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string>("");
  const [selectedIssue, setSelectedIssue] = useState<string>("");
  const [selectedVariety, setSelectedVariety] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");

  useEffect(() => {
    loadSeriesList().then((list) => {
      setSeriesList(list);
      setIsSeriesLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedSeries && selectedIssue && selectedVariety && selectedGrade) {
      const v = selectedVariety === NOVARIETY ? undefined : selectedVariety;
      setIsLoading(true);
      getCoinHistory(selectedSeries, selectedIssue, Number(selectedGrade), v).then((history) => {
        setPriceHistory(history);
        setIsLoading(false);
      });
    } else {
      setPriceHistory(undefined);
    }
  }, [selectedSeries, selectedIssue, selectedVariety, selectedGrade]);

  const handleSeriesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedSeries(value);
    setSelectedIssue("");
    setSelectedVariety("");
    setSelectedGrade("");
    setVarietyList([]);
    if (value) {
      setIssueList(seriesList.find((s) => s.name === value)!.issues);
    } else {
      setIssueList([]);
    }
  };

  const handleIssueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedIssue(value);
    setSelectedGrade("");
    if (value) {
      const varieties = issueList
        .filter((issue) => issue.name === value)
        .map((issue) => issue.variety || NOVARIETY)
        .filter((v, i, arr) => arr.indexOf(v) === i);
      setVarietyList(varieties);
      setSelectedVariety(varieties.length === 1 ? varieties[0] : "");
    } else {
      setVarietyList([]);
      setSelectedVariety("");
    }
  };

  const handleVarietyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVariety(e.target.value);
    setSelectedGrade("");
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGrade(e.target.value);
  };

  const showVarietySelect = !!selectedIssue && varietyList.length > 1;

  const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";
  const labelClass = "block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1";

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-800">Coin Price History</h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${showVarietySelect ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <div>
              <label className={labelClass}>Series</label>
              <select value={selectedSeries} onChange={handleSeriesChange} disabled={isSeriesLoading} className={selectClass}>
                <option value="">{isSeriesLoading ? 'Loading…' : '— Select —'}</option>
                {seriesList.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Issue</label>
              <select value={selectedIssue} onChange={handleIssueChange} disabled={!selectedSeries} className={selectClass}>
                <option value="">— Select —</option>
                {issueList
                  .filter((issue, idx, arr) => arr.findIndex((i) => i.name === issue.name) === idx)
                  .map((issue) => (
                    <option key={issue.name} value={issue.name}>{issue.name}</option>
                  ))}
              </select>
            </div>

            {showVarietySelect && (
              <div>
                <label className={labelClass}>Variety</label>
                <select value={selectedVariety} onChange={handleVarietyChange} disabled={!selectedIssue} className={selectClass}>
                  <option value="">— Select —</option>
                  {varietyList.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={labelClass}>Grade</label>
              <select value={selectedGrade} onChange={handleGradeChange} disabled={!selectedVariety} className={selectClass}>
                <option value="">— Select —</option>
                {grades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <PriceChart
          priceHistory={priceHistory}
          isLoading={isLoading}
          series={selectedSeries}
          issue={selectedIssue}
          variety={selectedVariety}
          grade={selectedGrade ? Number(selectedGrade) : undefined}
        />
      </main>
    </div>
  );
}
