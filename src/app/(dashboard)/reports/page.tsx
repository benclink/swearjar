import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingUp, CreditCard, Calendar } from "lucide-react";

const reports = [
  {
    title: "Monthly Summary",
    description: "Detailed breakdown of spending by category for any month",
    icon: Calendar,
    href: "/reports/monthly",
  },
  {
    title: "Essential vs Discretionary",
    description: "Analysis of your spending balance and trends over time",
    icon: TrendingUp,
    href: "/reports/balance",
  },
  {
    title: "Subscription Audit",
    description: "Review all recurring subscriptions and their annual cost",
    icon: CreditCard,
    href: "/reports/subscriptions",
  },
];

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate detailed financial reports and insights
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <report.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Reports via Chat</CardTitle>
          <CardDescription>
            You can also generate reports by asking the chat assistant. Try:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>&quot;Show me a summary for November 2025&quot;</li>
            <li>&quot;Compare my spending this month vs last month&quot;</li>
            <li>&quot;What are my recurring subscriptions?&quot;</li>
            <li>&quot;How much have I spent on dining out this year?&quot;</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
