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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94a3b8" }} className="dark:fill-slate-400" tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} className="dark:fill-slate-400" tickLine={false} axisLine={false} width={20} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          wrapperClassName="dark:[&_.recharts-tooltip-wrapper]:!bg-slate-800 dark:[&_.recharts-tooltip-wrapper]:!border-slate-700"
          cursor={{ fill: "rgba(59,130,246,0.06)" }}
          formatter={(value: number) => [`${value} transaction${value !== 1 ? 's' : ''}`, '']}
          labelFormatter={(label) => label}
        />
        <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
