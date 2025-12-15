import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, AlertTriangle, CheckCircle, Calendar } from "lucide-react";
import Link from "next/link";

interface Transaction {
  id: string;
  description: string;
  merchant_normalised: string | null;
  amount: number;
  date: string;
  category: string | null;
}

interface Subscription {
  merchant: string;
  amount: number;
  frequency: "monthly" | "yearly" | "weekly" | "unknown";
  annualCost: number;
  lastSeen: string;
  occurrences: number;
  category: string | null;
  transactions: Transaction[];
}

function detectFrequency(dates: Date[]): "monthly" | "yearly" | "weekly" | "unknown" {
  if (dates.length < 2) return "unknown";

  // Sort dates chronologically
  const sorted = dates.sort((a, b) => a.getTime() - b.getTime());

  // Calculate average gap in days
  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGap += (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24);
  }
  const avgGap = totalGap / (sorted.length - 1);

  if (avgGap <= 10) return "weekly";
  if (avgGap <= 45) return "monthly";
  if (avgGap <= 400) return "yearly";
  return "unknown";
}

function calculateAnnualCost(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly": return amount * 52;
    case "monthly": return amount * 12;
    case "yearly": return amount;
    default: return amount * 12; // Assume monthly if unknown
  }
}

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Look back 12 months for recurring transactions
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startDate = oneYearAgo.toISOString().split("T")[0];

  const { data: transactionsRaw } = await supabase
    .from("transactions")
    .select("id, description, merchant_normalised, amount, date, category")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .gt("amount", 0)
    .order("date", { ascending: false });

  const transactions = transactionsRaw as Transaction[] | null;

  // Group by merchant and find recurring
  const byMerchant: Record<string, Transaction[]> = {};
  transactions?.forEach((t) => {
    const key = t.merchant_normalised || t.description;
    if (!byMerchant[key]) {
      byMerchant[key] = [];
    }
    byMerchant[key].push(t);
  });

  // Identify subscriptions (3+ occurrences with similar amounts)
  const subscriptions: Subscription[] = [];

  Object.entries(byMerchant).forEach(([merchant, txns]) => {
    if (txns.length < 3) return;

    // Group by similar amounts (within 10%)
    const amountGroups: Record<number, Transaction[]> = {};
    txns.forEach((t) => {
      const roundedAmount = Math.round(t.amount);
      // Find existing group within 10%
      const existingKey = Object.keys(amountGroups).find((k) => {
        const keyAmount = parseInt(k);
        return Math.abs(keyAmount - t.amount) / keyAmount < 0.1;
      });

      if (existingKey) {
        amountGroups[parseInt(existingKey)].push(t);
      } else {
        amountGroups[roundedAmount] = [t];
      }
    });

    // Process each amount group
    Object.entries(amountGroups).forEach(([, groupTxns]) => {
      if (groupTxns.length < 3) return;

      const dates = groupTxns.map((t) => new Date(t.date));
      const frequency = detectFrequency(dates);
      const avgAmount = groupTxns.reduce((sum, t) => sum + t.amount, 0) / groupTxns.length;
      const annualCost = calculateAnnualCost(avgAmount, frequency);

      // Only include if it looks like a subscription (regular interval)
      if (frequency !== "unknown") {
        subscriptions.push({
          merchant,
          amount: avgAmount,
          frequency,
          annualCost,
          lastSeen: groupTxns[0].date,
          occurrences: groupTxns.length,
          category: groupTxns[0].category,
          transactions: groupTxns,
        });
      }
    });
  });

  // Sort by annual cost
  subscriptions.sort((a, b) => b.annualCost - a.annualCost);

  // Calculate totals
  const totalAnnual = subscriptions.reduce((sum, s) => sum + s.annualCost, 0);
  const totalMonthly = totalAnnual / 12;
  const activeCount = subscriptions.length;

  // Detect potentially inactive (not seen in 60+ days)
  const now = new Date();
  const inactiveSubscriptions = subscriptions.filter((s) => {
    const lastSeen = new Date(s.lastSeen);
    const daysSince = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 60;
  });

  const frequencyLabel = (freq: string) => {
    switch (freq) {
      case "weekly": return "Weekly";
      case "monthly": return "Monthly";
      case "yearly": return "Yearly";
      default: return "Recurring";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/dashboard/reports" className="hover:underline">Reports</Link>
          <span>/</span>
          <span>Subscription Audit</span>
        </div>
        <h1 className="text-3xl font-bold">Subscription Audit</h1>
        <p className="text-muted-foreground">Review your recurring subscriptions and their annual cost</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Cost</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAnnual)}</div>
            <p className="text-xs text-muted-foreground">
              Estimated yearly spend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMonthly)}</div>
            <p className="text-xs text-muted-foreground">
              Average monthly spend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">
              Detected recurring payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Possibly Inactive</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveSubscriptions.length}</div>
            <p className="text-xs text-muted-foreground">
              Not charged in 60+ days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Potentially Inactive Warning */}
      {inactiveSubscriptions.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Potentially Inactive Subscriptions
            </CardTitle>
            <CardDescription>
              These haven&apos;t been charged recently - they may be cancelled or paused
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactiveSubscriptions.map((sub) => (
                <div key={sub.merchant} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{sub.merchant}</p>
                    <p className="text-sm text-muted-foreground">
                      Last charged: {formatDate(sub.lastSeen)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(sub.amount)}</p>
                    <Badge variant="outline">{frequencyLabel(sub.frequency)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>All Detected Subscriptions</CardTitle>
          <CardDescription>
            Recurring payments detected in the last 12 months, sorted by annual cost
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No recurring subscriptions detected. Subscriptions are identified when a merchant charges you 3+ times at regular intervals.
            </p>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub, index) => {
                const daysSinceLastSeen = Math.floor(
                  (now.getTime() - new Date(sub.lastSeen).getTime()) / (1000 * 60 * 60 * 24)
                );
                const isInactive = daysSinceLastSeen > 60;

                return (
                  <div
                    key={`${sub.merchant}-${index}`}
                    className={`flex items-center justify-between py-3 border-b last:border-0 ${
                      isInactive ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-muted-foreground w-8 text-right font-mono">
                        {index + 1}.
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{sub.merchant}</p>
                          {isInactive && (
                            <Badge variant="outline" className="text-orange-500 border-orange-500">
                              Inactive?
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="secondary">{frequencyLabel(sub.frequency)}</Badge>
                          {sub.category && <span>{sub.category}</span>}
                          <span>• {sub.occurrences} charges</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(sub.amount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(sub.annualCost)}/year
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Review yearly subscriptions before they auto-renew</li>
            <li>• Consider annual plans for services you use regularly - they&apos;re often cheaper</li>
            <li>• Cancel unused subscriptions to save {formatCurrency(inactiveSubscriptions.reduce((s, sub) => s + sub.annualCost, 0))}/year</li>
            <li>• Some services offer family or student discounts</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
