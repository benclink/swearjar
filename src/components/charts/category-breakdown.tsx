"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface CategoryBreakdownProps {
  data: Record<string, { amount: number; classification: string }>;
}

const COLORS = {
  Essential: "hsl(142, 76%, 36%)",
  Discretionary: "hsl(45, 93%, 47%)",
};

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const chartData = Object.entries(data)
    .map(([name, { amount, classification }]) => ({
      name: name.length > 15 ? name.substring(0, 15) + "..." : name,
      fullName: name,
      amount,
      classification,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No spending data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
        <XAxis
          type="number"
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          width={100}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelFormatter={(_, payload) => payload[0]?.payload?.fullName || ""}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[entry.classification as keyof typeof COLORS] || COLORS.Discretionary}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
