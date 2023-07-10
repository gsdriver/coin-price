
import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LineElement, PointElement, LinearScale, Title, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { formatMonth, formatPrice } from "@/utils";

ChartJS.register(CategoryScale, LineElement, PointElement, LinearScale, Title, Tooltip);

interface PriceChartProps {
  priceHistory?: {price_as_of: string, grade: number, price: number}[];
  issue?: string;
  series?: string;
  grade?: number;
  variety?: string;
};

export const PriceChart = (props: PriceChartProps) => {
  const [priceData, setPriceData] = useState<{ labels: string[], datasets: any[] }>();
  useEffect(() => {
    let result: { labels: string[], datasets: any[] } | undefined;

    if (props.priceHistory) {
      // Turn this into a history by month from the first date to the current date
      const d: Date = new Date(props.priceHistory[0].price_as_of);
      d.setMonth(d.getMonth());
      d.setDate(1);

      const lastDate: Date = new Date();
      lastDate.setMonth(lastDate.getMonth() + 1);
      lastDate.setDate(1);

      const data = [];
      while (d < lastDate) {
        // Find the price as of this date
        let idx: number = props.priceHistory
          .findIndex((h) => new Date(h.price_as_of).getTime() > d.getTime()) - 1;
        if (idx < 0) {
          idx = 0;
        }
        data.push({ price_as_of: formatMonth(d), price: props.priceHistory[idx].price });

        // Go forward a month
        d.setMonth(d.getMonth() + 1);
      }

      result = {
        labels: data.map((h) => h.price_as_of),
        datasets: [{
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          data: data.map((h) => h.price),
        }],
      };
    }

    setPriceData(result);
  }, [props.priceHistory]);

  if (!priceData) {
    return null;
  }

  const options = {
    responsive: true,
    scales: {
      y: {
        ticks: {
          // Include a dollar sign in the ticks
          callback: function(value: number, index: number) {
            return formatPrice(value);
          }
        }
      },
    },
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `${props.issue} ${props.series} ${props.variety || ""} Grade: ${props.grade}`,
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: any) => {
            return formatPrice(context.dataset.data[context.dataIndex]);
          },
        }
      }
    },
  };

  return (
    <Line options={options} data={priceData} />
  );
};
