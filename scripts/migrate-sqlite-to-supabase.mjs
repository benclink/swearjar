/**
 * Migration Script: SQLite to Supabase
 *
 * This script migrates data from the existing SQLite database to Supabase Postgres.
 *
 * Prerequisites:
 * 1. Run the schema.sql in Supabase SQL Editor first
 * 2. Create a user account in Supabase Auth
 * 3. Set environment variables:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY (not anon key - we need admin access)
 *    - SQLITE_PATH (path to transactions.db)
 *    - USER_ID (the Supabase user ID to assign transactions to)
 *
 * Run with: npx tsx scripts/migrate-sqlite-to-supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SQLITE_PATH = process.env.SQLITE_PATH || "../Finances/Data/transactions.db";
const USER_ID = process.env.USER_ID || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !USER_ID) {
  console.error("Missing required environment variables:");
  console.error("  SUPABASE_URL:", SUPABASE_URL ? "✓" : "✗");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "✓" : "✗");
  console.error("  USER_ID:", USER_ID ? "✓" : "✗");
  process.exit(1);
}

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const sqlite = new Database(SQLITE_PATH, { readonly: true });

interface SQLiteTransaction {
  id: string;
  date: string;
  time: string | null;
  description: string;
  amount: number;
  source: string;
  source_account: string | null;
  classification: string | null;
  category: string | null;
  original_category: string | null;
  merchant_normalised: string | null;
  is_transfer: number;
  linked_bnpl_id: string | null;
  needs_review: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Merchant mappings from CLAUDE.md (subset for seeding)
const MERCHANT_MAPPINGS = [
  // Groceries
  { pattern: "coles", category: "Groceries" },
  { pattern: "woolworths", category: "Groceries" },
  { pattern: "aldi", category: "Groceries" },
  { pattern: "costco wholesale", category: "Groceries" },
  { pattern: "iga", category: "Groceries" },
  { pattern: "marley spoon", category: "Groceries" },

  // Fuel
  { pattern: "bp", category: "Transport - Fuel" },
  { pattern: "ampol", category: "Transport - Fuel" },
  { pattern: "shell", category: "Transport - Fuel" },
  { pattern: "7-eleven", category: "Transport - Fuel" },
  { pattern: "reddy express", category: "Transport - Fuel" },

  // Tolls
  { pattern: "linkt", category: "Transport - Tolls" },

  // Insurance
  { pattern: "budget direct", category: "Insurance" },
  { pattern: "ahm", category: "Insurance" },
  { pattern: "auto & general", category: "Insurance" },

  // Utilities
  { pattern: "red energy", category: "Utilities" },
  { pattern: "starlink", category: "Utilities" },
  { pattern: "optus", category: "Utilities" },
  { pattern: "telstra", category: "Utilities" },
  { pattern: "wollondilly", category: "Utilities" },

  // Healthcare
  { pattern: "priceline", category: "Healthcare" },
  { pattern: "terrywhite", category: "Healthcare" },
  { pattern: "pharmacy", category: "Healthcare" },

  // Dining
  { pattern: "mcdonald", category: "Dining Out" },
  { pattern: "coffee", category: "Dining Out" },
  { pattern: "cafe", category: "Dining Out" },
  { pattern: "restaurant", category: "Dining Out" },
  { pattern: "hotel", category: "Dining Out" },

  // Alcohol
  { pattern: "liquorland", category: "Alcohol" },
  { pattern: "bws", category: "Alcohol" },
  { pattern: "dan murphy", category: "Alcohol" },

  // Retail
  { pattern: "kmart", category: "Shopping - General" },
  { pattern: "target", category: "Shopping - General" },
  { pattern: "big w", category: "Shopping - General" },
  { pattern: "amazon", category: "Shopping - Online" },
  { pattern: "ebay", category: "Shopping - Online" },

  // Subscriptions
  { pattern: "netflix", category: "Subscriptions - Media" },
  { pattern: "spotify", category: "Subscriptions - Media" },
  { pattern: "disney", category: "Subscriptions - Media" },
  { pattern: "apple services", category: "Subscriptions - Media" },
  { pattern: "google payment", category: "Subscriptions - Media" },

  // Home & Garden
  { pattern: "bunnings", category: "Home & Garden" },
  { pattern: "mitre 10", category: "Home & Garden" },

  // Pets
  { pattern: "petstock", category: "Pets" },
  { pattern: "petbarn", category: "Pets" },

  // BNPL
  { pattern: "afterpay", category: "BNPL Instalments" },
  { pattern: "zippay", category: "BNPL Instalments" },
  { pattern: "zip pay", category: "BNPL Instalments" },

  // Loans
  { pattern: "plenti", category: "Loan Repayments" },
  { pattern: "ing", category: "Mortgage" },
];

async function migrateTransactions() {
  console.log("Starting transaction migration...");

  // Read all transactions from SQLite
  const transactions = sqlite.prepare("SELECT * FROM transactions").all() as SQLiteTransaction[];
  console.log(`Found ${transactions.length} transactions to migrate`);

  // Batch insert (Supabase has a limit of ~1000 per request)
  const BATCH_SIZE = 500;
  let migrated = 0;
  let errors = 0;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE).map((t) => ({
      id: t.id,
      user_id: USER_ID,
      date: t.date,
      time: t.time,
      description: t.description,
      amount: t.amount,
      source: t.source,
      source_account: t.source_account,
      classification: t.classification as "Essential" | "Discretionary" | "Non-Spending" | "Income" | null,
      category: t.category,
      original_category: t.original_category,
      merchant_normalised: t.merchant_normalised,
      is_transfer: Boolean(t.is_transfer),
      linked_bnpl_id: t.linked_bnpl_id,
      needs_review: Boolean(t.needs_review),
      notes: t.notes,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));

    const { error } = await supabase.from("transactions").upsert(batch, {
      onConflict: "id",
    });

    if (error) {
      console.error(`Error migrating batch ${i / BATCH_SIZE + 1}:`, error.message);
      errors += batch.length;
    } else {
      migrated += batch.length;
      console.log(`Migrated ${migrated}/${transactions.length} transactions...`);
    }
  }

  console.log(`\nTransaction migration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Errors: ${errors}`);

  return migrated;
}

async function seedMerchantMappings() {
  console.log("\nSeeding merchant mappings...");

  const mappings = MERCHANT_MAPPINGS.map((m) => ({
    user_id: null, // Global mappings
    merchant_pattern: m.pattern,
    category: m.category,
  }));

  const { error, count } = await supabase
    .from("merchant_mappings")
    .upsert(mappings, { onConflict: "user_id,merchant_pattern" });

  if (error) {
    console.error("Error seeding merchant mappings:", error.message);
    return 0;
  }

  console.log(`Seeded ${mappings.length} merchant mappings`);
  return mappings.length;
}

async function verifyMigration() {
  console.log("\nVerifying migration...");

  // Check transaction count
  const { count: txCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", USER_ID);

  // Check categories
  const { count: catCount } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true });

  // Check merchant mappings
  const { count: mapCount } = await supabase
    .from("merchant_mappings")
    .select("*", { count: "exact", head: true });

  console.log(`\nVerification results:`);
  console.log(`  Transactions: ${txCount}`);
  console.log(`  Categories: ${catCount}`);
  console.log(`  Merchant mappings: ${mapCount}`);

  // Sample some transactions
  const { data: sample } = await supabase
    .from("transactions")
    .select("date, description, amount, category, classification")
    .eq("user_id", USER_ID)
    .order("date", { ascending: false })
    .limit(5);

  console.log(`\nSample transactions:`);
  sample?.forEach((t) => {
    console.log(`  ${t.date} | $${t.amount.toFixed(2)} | ${t.category} | ${t.description.substring(0, 40)}`);
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("SQLite to Supabase Migration");
  console.log("=".repeat(60));
  console.log(`\nSource: ${SQLITE_PATH}`);
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`User ID: ${USER_ID}`);
  console.log("");

  try {
    await migrateTransactions();
    await seedMerchantMappings();
    await verifyMigration();

    console.log("\n" + "=".repeat(60));
    console.log("Migration complete!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

main();
