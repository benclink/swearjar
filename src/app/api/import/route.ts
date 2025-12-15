import { createClient } from "@/lib/supabase/server";
import { runImportAgent, parseUBankCSV, parsePayPalCSV } from "@/lib/agents/import";
import { NextResponse } from "next/server";

export const maxDuration = 120; // CSV imports can take a while

// POST /api/import - Import transactions from CSV
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!fileType || !["ubank", "paypal"].includes(fileType)) {
      return NextResponse.json(
        { error: "Invalid file type. Must be 'ubank' or 'paypal'" },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Parse based on file type
    let transactions;
    switch (fileType) {
      case "ubank":
        transactions = parseUBankCSV(content);
        break;
      case "paypal":
        transactions = parsePayPalCSV(content);
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported file type" },
          { status: 400 }
        );
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "No valid transactions found in file" },
        { status: 400 }
      );
    }

    // Create import record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: importRecord } = await (supabase.from("csv_imports") as any)
      .insert({
        user_id: user.id,
        filename: file.name,
        file_type: fileType,
        status: "processing",
        total_rows: transactions.length,
      })
      .select("id")
      .single();

    // Run the import agent
    const result = await runImportAgent(user.id, transactions);

    // Update import record with results
    if (importRecord) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("csv_imports") as any)
        .update({
          status: result.success ? "completed" : "failed",
          imported_rows: result.imported,
          skipped_rows: result.skipped,
          error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", importRecord.id);
    }

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      needsReview: result.needsReview,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import transactions" },
      { status: 500 }
    );
  }
}

// GET /api/import - Get import history
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: imports } = await supabase
    .from("csv_imports")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ imports: imports || [] });
}
