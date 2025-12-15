"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface MonthData {
  month: string;
  year: number;
  essential: number;
  discretionary: number;
  total: number;
  ratio: number;
}

interface BalanceTrendChartProps {
  data: MonthData[];
}

export function BalanceTrendChart({ data }: BalanceTrendChartProps) {
  if (data.length === 0 || data.every(d => d.total === 0)) {
    return (
      <div className="flex h-[350px] items-center justify-center text-muted-foreground">
        No spending data available
      </div>
    );
  }

  const chartData = data.map(d => ({
    name: `${d.month} ${d.year}`,
    Essential: d.essential,
    Discretionary: d.discretionary,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="essentialGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="discretionaryGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="Essential"
          stackId="1"
          stroke="hsl(142, 76%, 36%)"
          fill="url(#essentialGradient)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="Discretionary"
          stackId="1"
          stroke="hsl(45, 93%, 47%)"
          fill="url(#discretionaryGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
