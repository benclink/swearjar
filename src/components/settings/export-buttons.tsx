"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportTransactionsCSV, exportBudgetReport } from "@/app/actions/export";
import { Download, Loader2 } from "lucide-react";

export function ExportButtons() {
  const [isExportingTransactions, setIsExportingTransactions] = useState(false);
  const [isExportingBudget, setIsExportingBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTransactions = async () => {
    setIsExportingTransactions(true);
    setError(null);

    try {
      const result = await exportTransactionsCSV();

      if (result.error) {
        setError(result.error);
      } else if (result.csv && result.filename) {
        downloadCSV(result.csv, result.filename);
      }
    } catch (err) {
      setError("Failed to export transactions");
    } finally {
      setIsExportingTransactions(false);
    }
  };

  const handleExportBudget = async () => {
    setIsExportingBudget(true);
    setError(null);

    try {
      const result = await exportBudgetReport();

      if (result.error) {
        setError(result.error);
      } else if (result.csv && result.filename) {
        downloadCSV(result.csv, result.filename);
      }
    } catch (err) {
      setError("Failed to export budget report");
    } finally {
      setIsExportingBudget(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={handleExportTransactions}
          disabled={isExportingTransactions}
        >
          {isExportingTransactions ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export Transactions (CSV)
        </Button>
        <Button
          variant="outline"
          onClick={handleExportBudget}
          disabled={isExportingBudget}
        >
          {isExportingBudget ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export Budget Report
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
