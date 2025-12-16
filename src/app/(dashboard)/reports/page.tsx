import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp, CreditCard } from "lucide-react";

const reports = [
  {
    title: "Monthly Summary",
    description: "Spending breakdown by category for any month",
    icon: Calendar,
    href: "/reports/monthly",
  },
  {
    title: "Balance Analysis",
    description: "Essential vs discretionary spending trends",
    icon: TrendingUp,
    href: "/reports/balance",
  },
  {
    title: "Subscriptions",
    description: "Recurring charges and annual costs",
    icon: CreditCard,
    href: "/reports/subscriptions",
  },
];

export default function ReportsPage() {
  return (
    <div className="p-6 lg:p-10 space-y-10 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <report.icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
          Quick Reports
        </h2>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground mb-4">
              Ask the assistant for custom reports:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>&quot;Summary for November 2025&quot;</li>
              <li>&quot;Compare this month vs last month&quot;</li>
              <li>&quot;How much on dining this year?&quot;</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
