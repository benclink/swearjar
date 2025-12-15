"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface IncomeExpenseChartProps {
  income: number;
  expenses: number;
}

const COLORS = {
  income: "hsl(142, 76%, 36%)", // Green
  expenses: "hsl(0, 84%, 60%)", // Red
  net: "hsl(217, 91%, 60%)", // Blue for net
};

export function IncomeExpenseChart({ income, expenses }: IncomeExpenseChartProps) {
  const net = income - expenses;

  const data = [
    { name: "Income", value: income, fill: COLORS.income },
    { name: "Expenses", value: expenses, fill: COLORS.expenses },
  ];

  if (income === 0 && expenses === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No income or expense data for this period
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
          <XAxis
            type="number"
            tickFormatter={(value) => formatCurrency(value)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
          <ReferenceLine x={0} stroke="hsl(var(--border))" />
        </BarChart>
      </ResponsiveContainer>

      {/* Net Summary */}
      <div className={`text-center p-3 rounded-lg ${net >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
        <p className="text-sm text-muted-foreground">Net Savings</p>
        <p className={`text-2xl font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
          {net >= 0 ? "+" : ""}{formatCurrency(net)}
        </p>
        <p className="text-xs text-muted-foreground">
          {net >= 0
            ? `You saved ${income > 0 ? ((net / income) * 100).toFixed(0) : 0}% of your income`
            : `You overspent by ${formatCurrency(Math.abs(net))}`
          }
        </p>
      </div>
    </div>
  );
}
