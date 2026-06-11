import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { renderContractPdf } from "@/lib/growth-partners/contract-pdf";
import { rowToFields, rowToSign } from "@/lib/growth-partners/from-row";
import { downloadFinalPdf, signingHash } from "@/lib/growth-partners/finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sign/[token]/final — the fully-signed PDF (download). Both parties.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("growth_partners")
    .select("*")
    .eq("sign_token", token)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status !== "completed") {
    return NextResponse.json({ error: "not_completed" }, { status: 409 });
  }

  // Prefer the archived copy; fall back to a fresh (deterministic) render.
  let bytes: Uint8Array | null = row.final_pdf_path
    ? await downloadFinalPdf(admin, row.final_pdf_path)
    : null;
  if (!bytes) {
    const sign = { ...rowToSign(row), documentHash: row.document_hash || signingHash(row) };
    bytes = new Uint8Array(await renderContractPdf(rowToFields(row), sign));
  }

  const fname = `Peekr-Growth-Partner-${row.username}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, "");
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
