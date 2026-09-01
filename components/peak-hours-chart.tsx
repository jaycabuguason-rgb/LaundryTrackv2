"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PeakHoursChartProps {
  data: { hour: string; count: number }[];
}

export default function PeakHoursChart({ data }: PeakHoursChartProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barSize={10}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" className="dark:stroke-[hsl(255_15%_18%)]" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(251 18% 49%)" }} className="dark:fill-[hsl(255_10%_55%)]" tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "hsl(251 18% 49%)" }} className="dark:fill-[hsl(255_10%_55%)]" tickLine={false} axisLine={false} width={20} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid hsl(33 18% 82%)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          wrapperClassName="dark:[&_.recharts-tooltip-wrapper]:!bg-[hsl(255_20%_11%)] dark:[&_.recharts-tooltip-wrapper]:!border-[hsl(255_15%_18%)]"
          cursor={{ fill: "hsl(257 58% 49% / 0.06)" }}
          formatter={(value: number) => [`${value} transaction${value !== 1 ? 's' : ''}`, '']}
          labelFormatter={(label) => label}
        />
        <Bar dataKey="count" fill="hsl(257 58% 49%)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
