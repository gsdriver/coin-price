
import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LineElement, PointElement, LinearScale, Title, Tooltip, Filler } from "chart.js";
import { Line } from "react-chartjs-2";
import { formatMonth, formatPrice } from "@/utils";

ChartJS.register(CategoryScale, LineElement, PointElement, LinearScale, Title, Tooltip, Filler);

interface PriceChartProps {
  priceHistory?: {price_as_of: string, grade: number, price: number}[];
  isLoading?: boolean;
  issue?: string;
  series?: string;
  grade?: number;
  variety?: string;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const friendlyMonth = (mmYYYY: string): string => {
  const [mm, yyyy] = mmYYYY.split('-');
  return `${MONTH_NAMES[parseInt(mm, 10) - 1]} ${yyyy}`;
};

export const PriceChart = (props: PriceChartProps) => {
  const [priceData, setPriceData] = useState<{ labels: string[], datasets: any[] }>();
  const [stats, setStats] = useState<{ firstPrice: number, lastPrice: number, firstLabel: string } | undefined>();

  useEffect(() => {
    if (!props.priceHistory || props.priceHistory.length === 0) {
      setPriceData(undefined);
      setStats(undefined);
      return;
    }

    const d = new Date(props.priceHistory[0].price_as_of);
    d.setDate(1);
    const lastDate = new Date();
    lastDate.setMonth(lastDate.getMonth() + 1);
    lastDate.setDate(1);

    const data = [];
    while (d < lastDate) {
      let idx = props.priceHistory.findIndex((h) => new Date(h.price_as_of).getTime() > d.getTime());
      if (idx < 0) idx = props.priceHistory.length;
      idx = Math.max(0, idx - 1);
      data.push({ price_as_of: formatMonth(d), price: props.priceHistory[idx].price });
      d.setMonth(d.getMonth() + 1);
    }

    setPriceData({
      labels: data.map((h) => h.price_as_of),
      datasets: [{
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        data: data.map((h) => h.price),
        fill: true,
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
      }],
    });

    setStats({
      firstPrice: data[0].price,
      lastPrice: data[data.length - 1].price,
      firstLabel: data[0].price_as_of,
    });
  }, [props.priceHistory]);

  const cardClass = "w-full bg-white rounded-xl border border-slate-200 shadow-sm";

  if (props.isLoading) {
    return (
      <div className={`${cardClass} p-20 flex items-center justify-center`}>
        <p className="text-slate-400 text-sm">Loading price history…</p>
      </div>
    );
  }

  if (!priceData || !stats) {
    return (
      <div className={`${cardClass} p-20 flex items-center justify-center`}>
        <p className="text-slate-400 text-sm">Select a coin above to view its price history</p>
      </div>
    );
  }

  const pctChange = ((stats.lastPrice - stats.firstPrice) / stats.firstPrice) * 100;
  const isUp = pctChange >= 0;

  const coinLabel = [props.issue, props.series, props.variety && props.variety !== 'No variety' ? props.variety : null]
    .filter(Boolean).join(' ');

  const options = {
    responsive: true,
    scales: {
      y: {
        ticks: {
          callback: (value: string | number) => formatPrice(Number(value)),
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => formatPrice(context.dataset.data[context.dataIndex]),
        },
      },
    },
  };

  return (
    <div className={cardClass}>
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            {coinLabel} &middot; Grade {props.grade}
          </p>
          <p className="text-2xl font-bold text-slate-900">{formatPrice(stats.lastPrice)}</p>
        </div>
        <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${isUp ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}% since {friendlyMonth(stats.firstLabel)}
        </span>
      </div>

      <div className="px-4 py-4">
        <Line options={options} data={priceData} />
      </div>
    </div>
  );
};
