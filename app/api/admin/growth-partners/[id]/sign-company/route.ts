import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, clientIp } from "@/lib/growth-partners/admin-auth";

export const dynamic = "force-dynamic";

// POST /api/admin/growth-partners/[id]/sign-company
// Body: { signature: <dataURL> } — the founder's drawn/typed signature.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { signature?: string };
  const signature = body.signature?.trim();
  if (!signature || !signature.startsWith("data:image")) {
    return NextResponse.json({ error: "Firma requerida" }, { status: 400 });
  }

  const ip = clientIp(req);
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("growth_partners")
    .update({
      company_signature: signature,
      company_signer_name: "Jorge Enrique Martinelli Remond",
      company_signed_at: now,
      company_ip: ip,
      status: "company_signed",
      updated_at: now,
    })
    .eq("id", id)
    .in("status", ["draft", "company_signed"]) // don't re-sign completed ones
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("growth_partner_audit").insert({
    partner_id: id,
    event: "company_signed",
    actor: "company",
    ip,
  });

  return NextResponse.json({ contract: data });
}
