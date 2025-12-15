"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type ImportStatus = "idle" | "uploading" | "parsing" | "preview" | "importing" | "complete" | "error";

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  classification: string | null;
  needsReview: boolean;
}

export default function ImportPage() {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [stats, setStats] = useState<{ total: number; categorized: number; needsReview: number } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  }, []);

  const processFile = async (file: File) => {
    setStatus("uploading");
    setError(null);

    try {
      // Read file content
      const text = await file.text();
      setStatus("parsing");

      // Detect file type from headers
      const firstLine = text.split("\n")[0];
      let detectedType = "unknown";

      if (firstLine.includes("Date and time") && firstLine.includes("From account")) {
        detectedType = "ubank";
      } else if (firstLine.includes("Time zone") && firstLine.includes("Transaction ID")) {
        detectedType = "paypal";
      }

      setFileType(detectedType);

      // Parse CSV (simplified - you'd want a proper CSV parser in production)
      const lines = text.split("\n").filter(line => line.trim());
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));

      const transactions: ParsedTransaction[] = [];

      for (let i = 1; i < Math.min(lines.length, 51); i++) { // Preview first 50
        const values = parseCSVLine(lines[i]);
        if (values.length < headers.length) continue;

        if (detectedType === "ubank") {
          const debit = parseAmount(values[2]);
          const credit = parseAmount(values[3]);
          const amount = debit > 0 ? debit : -credit;

          transactions.push({
            id: values[9]?.replace(/"/g, "") || `temp-${i}`,
            date: parseUbankDate(values[0]),
            description: values[1],
            amount,
            category: null, // Would be determined by merchant mapping
            classification: null,
            needsReview: true,
          });
        } else if (detectedType === "paypal") {
          const amount = parseFloat(values[7]?.replace(/,/g, "") || "0");
          if (amount >= 0 || values[4] !== "Completed") continue; // Only completed purchases

          transactions.push({
            id: values[13] || `temp-${i}`,
            date: parsePayPalDate(values[0]),
            description: `PayPal: ${values[3]}`,
            amount: Math.abs(amount),
            category: null,
            classification: null,
            needsReview: true,
          });
        }
      }

      setPreview(transactions);
      setStats({
        total: transactions.length,
        categorized: transactions.filter(t => t.category).length,
        needsReview: transactions.filter(t => t.needsReview).length,
      });
      setStatus("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setStatus("error");
    }
  };

  const handleImport = async () => {
    setStatus("importing");
    // In a real implementation, this would call an API to import the transactions
    // For now, we'll just simulate it
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStatus("complete");
  };

  const resetImport = () => {
    setStatus("idle");
    setError(null);
    setFileType(null);
    setPreview([]);
    setStats(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Transactions</h1>
        <p className="text-muted-foreground">
          Upload CSV files from Ubank, PayPal, or other sources
        </p>
      </div>

      {status === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Drag and drop a CSV file or click to browse. Supported formats: Ubank, PayPal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Drop your CSV file here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {(status === "uploading" || status === "parsing") && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">
                {status === "uploading" ? "Uploading file..." : "Parsing transactions..."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "preview" && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Import Preview</CardTitle>
                  <CardDescription>
                    Detected format: <Badge variant="secondary">{fileType}</Badge>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetImport}>
                    Cancel
                  </Button>
                  <Button onClick={handleImport}>
                    Import {stats?.total} Transactions
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats?.total}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Auto-categorized</p>
                  <p className="text-2xl font-bold">{stats?.categorized}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Needs Review</p>
                  <p className="text-2xl font-bold">{stats?.needsReview}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Description</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map((tx) => (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="py-3 text-sm">{tx.date}</td>
                        <td className="py-3 text-sm">{tx.description.substring(0, 50)}</td>
                        <td className="py-3">
                          {tx.category ? (
                            <Badge>{tx.category}</Badge>
                          ) : (
                            <Badge variant="outline">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Needs Review
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 text-right font-medium">
                          ${tx.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 20 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing first 20 of {preview.length} transactions
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {status === "importing" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Importing transactions...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "complete" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium">Import Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stats?.total} transactions imported successfully
              </p>
              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={resetImport}>
                  Import More
                </Button>
                <Button onClick={() => router.push("/transactions")}>
                  View Transactions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "error" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-medium">Import Failed</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button variant="outline" onClick={resetImport} className="mt-6">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper functions
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseAmount(str: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[$,]/g, "")) || 0;
}

function parseUbankDate(str: string): string {
  // Format: HH:MM DD-MM-YY
  const match = str.match(/(\d{2}:\d{2})\s+(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return str;
  const [, , day, month, year] = match;
  return `20${year}-${month}-${day}`;
}

function parsePayPalDate(str: string): string {
  // Format: DD/MM/YYYY
  const parts = str.split("/");
  if (parts.length !== 3) return str;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
