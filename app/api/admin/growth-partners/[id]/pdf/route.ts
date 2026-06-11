import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { renderContractPdf } from "@/lib/growth-partners/contract-pdf";
import { rowToFields, rowToSign } from "@/lib/growth-partners/from-row";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/growth-partners/[id]/pdf — current PDF (draft / signed).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const { data: row, error } = await admin
    .from("growth_partners")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await renderContractPdf(rowToFields(row), rowToSign(row));
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="growth-partner-${row.username}.pdf"`,
    },
  });
}
