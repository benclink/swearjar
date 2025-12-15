// lib/agents/import.ts
// CSV import agent for categorizing transactions

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

interface ParsedTransaction {
  id: string;
  date: string;
  time?: string;
  description: string;
  amount: number;
  source: string;
  source_account?: string;
  original_category?: string;
}

interface CategorizedTransaction extends ParsedTransaction {
  category: string;
  classification: "Essential" | "Discretionary" | "Non-Spending" | "Income";
  merchant_normalised: string;
  is_transfer: boolean;
  needs_review: boolean;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  needsReview: number;
  errors: string[];
}

// Get merchant mappings for a user
async function getMerchantMappings(userId: string): Promise<Map<string, { category: string; classification: string }>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("merchant_mappings")
    .select("merchant_pattern, category, classification")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("user_id", { ascending: false }); // User mappings take precedence

  const mappings = new Map<string, { category: string; classification: string }>();

  if (data) {
    for (const row of data as Array<{ merchant_pattern: string; category: string; classification: string | null }>) {
      // Only add if not already present (user mappings come first)
      if (!mappings.has(row.merchant_pattern.toLowerCase())) {
        mappings.set(row.merchant_pattern.toLowerCase(), {
          category: row.category,
          classification: row.classification || "Discretionary",
        });
      }
    }
  }

  return mappings;
}

// Get all valid categories
async function getCategories(): Promise<Map<string, string>> {
  const supabase = await createClient();

  const { data } = await supabase.from("categories").select("name, classification");

  const categories = new Map<string, string>();

  if (data) {
    for (const row of data as Array<{ name: string; classification: string }>) {
      categories.set(row.name, row.classification);
    }
  }

  return categories;
}

// Try to match a transaction to a merchant mapping
function matchMerchant(
  description: string,
  mappings: Map<string, { category: string; classification: string }>
): { category: string; classification: string } | null {
  const lowerDesc = description.toLowerCase();

  const entries = Array.from(mappings.entries());
  for (let i = 0; i < entries.length; i++) {
    const [pattern, mapping] = entries[i];
    if (lowerDesc.includes(pattern)) {
      return mapping;
    }
  }

  return null;
}

// Normalize merchant name from description
function normalizeMerchant(description: string): string {
  // Remove common prefixes
  let normalized = description
    .replace(/^(visa purchase|eftpos|direct debit|bpay|paypal \*)/i, "")
    .replace(/\s+\d{2}\/\d{2}.*$/, "") // Remove date suffixes
    .replace(/\s+[A-Z]{2,3}\s*$/, "") // Remove state codes
    .replace(/\s+aus(tralia)?$/i, "")
    .trim();

  // Take first meaningful part
  const parts = normalized.split(/\s{2,}|\t/);
  normalized = parts[0] || normalized;

  // Title case
  normalized = normalized
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return normalized.slice(0, 100); // Limit length
}

// Use Claude to categorize ambiguous transactions
async function categorizeWithClaude(
  transactions: ParsedTransaction[],
  categories: Map<string, string>
): Promise<Map<string, { category: string; classification: string; merchant: string }>> {
  if (transactions.length === 0) {
    return new Map();
  }

  const categoryList = Array.from(categories.entries())
    .map(([name, classification]) => `${name} (${classification})`)
    .join("\n");

  const transactionList = transactions
    .map((t, i) => `${i + 1}. "${t.description}" - $${Math.abs(t.amount).toFixed(2)} ${t.amount < 0 ? "(credit)" : "(debit)"}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are categorizing bank transactions. For each transaction, provide:
1. The category (must be from the list below)
2. A normalized merchant name (clean, consistent name for the business)

Categories:
${categoryList}

Rules:
- Income (credits) should be "Income - Salary" or "Income - Other"
- Internal transfers should be "Transfer - Internal"
- Family transfers should be "Transfer - Family"
- BNPL payments (Zip, Afterpay) should be "BNPL Instalments/Fees"
- When uncertain, choose the most likely category

Respond in JSON format:
{
  "categorizations": [
    { "index": 1, "category": "Category Name", "merchant": "Normalized Merchant" },
    ...
  ]
}`,
    messages: [
      {
        role: "user",
        content: `Categorize these transactions:\n${transactionList}`,
      },
    ],
  });

  const textContent = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  const results = new Map<string, { category: string; classification: string; merchant: string }>();

  if (textContent) {
    try {
      // Extract JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const cat of parsed.categorizations || []) {
          const transaction = transactions[cat.index - 1];
          if (transaction && categories.has(cat.category)) {
            results.set(transaction.id, {
              category: cat.category,
              classification: categories.get(cat.category)!,
              merchant: cat.merchant,
            });
          }
        }
      }
    } catch {
      // If parsing fails, transactions will need review
    }
  }

  return results;
}

// Main import function
export async function runImportAgent(
  userId: string,
  transactions: ParsedTransaction[]
): Promise<ImportResult> {
  const supabase = await createClient();

  const [mappings, categories] = await Promise.all([
    getMerchantMappings(userId),
    getCategories(),
  ]);

  const categorized: CategorizedTransaction[] = [];
  const needsClaude: ParsedTransaction[] = [];

  // First pass: use merchant mappings
  for (const t of transactions) {
    const mapping = matchMerchant(t.description, mappings);

    if (mapping) {
      categorized.push({
        ...t,
        category: mapping.category,
        classification: mapping.classification as CategorizedTransaction["classification"],
        merchant_normalised: normalizeMerchant(t.description),
        is_transfer: mapping.category.includes("Transfer"),
        needs_review: false,
      });
    } else {
      needsClaude.push(t);
    }
  }

  // Second pass: use Claude for ambiguous ones
  if (needsClaude.length > 0) {
    // Process in batches of 20
    const batchSize = 20;
    for (let i = 0; i < needsClaude.length; i += batchSize) {
      const batch = needsClaude.slice(i, i + batchSize);
      const claudeResults = await categorizeWithClaude(batch, categories);

      for (const t of batch) {
        const result = claudeResults.get(t.id);
        if (result) {
          categorized.push({
            ...t,
            category: result.category,
            classification: result.classification as CategorizedTransaction["classification"],
            merchant_normalised: result.merchant,
            is_transfer: result.category.includes("Transfer"),
            needs_review: false,
          });
        } else {
          // Couldn't categorize - mark for review
          categorized.push({
            ...t,
            category: "Shopping - General", // Default
            classification: "Discretionary",
            merchant_normalised: normalizeMerchant(t.description),
            is_transfer: false,
            needs_review: true,
          });
        }
      }
    }
  }

  // Insert transactions
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const t of categorized) {
    // Check if transaction already exists
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", t.id)
      .eq("user_id", userId)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("transactions") as any).insert({
      id: t.id,
      user_id: userId,
      date: t.date,
      time: t.time || null,
      description: t.description,
      amount: t.amount,
      source: t.source,
      source_account: t.source_account || null,
      original_category: t.original_category || null,
      category: t.category,
      classification: t.classification,
      merchant_normalised: t.merchant_normalised,
      is_transfer: t.is_transfer,
      needs_review: t.needs_review,
    });

    if (error) {
      errors.push(`Failed to import ${t.id}: ${error.message}`);
    } else {
      imported++;
    }
  }

  const needsReview = categorized.filter((t) => t.needs_review).length;

  return {
    success: errors.length === 0,
    imported,
    skipped,
    needsReview,
    errors,
  };
}

// Parse UBank CSV format
export function parseUBankCSV(csvContent: string): ParsedTransaction[] {
  const lines = csvContent.split("\n");
  const transactions: ParsedTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // UBank format: Date,Description,Amount
    const parts = line.split(",");
    if (parts.length >= 3) {
      const date = parts[0].trim();
      const description = parts[1].trim().replace(/^"|"$/g, "");
      const amount = parseFloat(parts[2].trim());

      if (date && description && !isNaN(amount)) {
        transactions.push({
          id: `ubank_${date}_${description.slice(0, 20)}_${amount}`.replace(/\s+/g, "_"),
          date: convertDateFormat(date),
          description,
          amount: -amount, // UBank shows credits as positive, we want debits as positive
          source: "ubank",
        });
      }
    }
  }

  return transactions;
}

// Parse PayPal CSV format
export function parsePayPalCSV(csvContent: string): ParsedTransaction[] {
  const lines = csvContent.split("\n");
  const transactions: ParsedTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // PayPal format varies but typically: Date,Time,Name,Type,Status,Currency,Gross,Fee,Net,etc
    const parts = parseCSVLine(line);
    if (parts.length >= 7) {
      const date = parts[0]?.trim();
      const time = parts[1]?.trim();
      const name = parts[3]?.trim() || parts[2]?.trim();
      const amount = parseFloat(parts[6]?.trim().replace(/[,$]/g, "") || "0");

      if (date && name && !isNaN(amount)) {
        transactions.push({
          id: `paypal_${date}_${name.slice(0, 20)}_${amount}`.replace(/\s+/g, "_"),
          date: convertDateFormat(date),
          time,
          description: name,
          amount: -amount, // PayPal shows payments as negative
          source: "paypal",
        });
      }
    }
  }

  return transactions;
}

// Helper to parse CSV line respecting quotes
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// Convert date from DD/MM/YYYY to YYYY-MM-DD
function convertDateFormat(date: string): string {
  const parts = date.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return date; // Return as-is if not in expected format
}
