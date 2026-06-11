import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { renderContractPdf } from "@/lib/growth-partners/contract-pdf";
import { rowToFields, rowToSign } from "@/lib/growth-partners/from-row";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sign/[token]/pdf — current contract (for the partner to review).
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

  const pdf = await renderContractPdf(rowToFields(row), rowToSign(row));
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"growth-partner-agreement.pdf\"",
    },
  });
}
