import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { clientIp } from "@/lib/growth-partners/admin-auth";
import { finalizeContract } from "@/lib/growth-partners/finalize";

export const dynamic = "force-dynamic";

const SIGNABLE = ["company_signed", "sent"];

// GET /api/sign/[token] — partner-facing contract metadata.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("growth_partners")
    .select(
      "id, country, partner_legal_name, brand_name, username, percentage, effective_date, status, company_signed_at, partner_signed_at"
    )
    .eq("sign_token", token)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    country: row.country,
    partnerName: row.partner_legal_name,
    brandName: row.brand_name,
    username: row.username,
    percentage: row.percentage,
    status: row.status,
    signable: SIGNABLE.includes(row.status),
    completed: row.status === "completed",
    companySignedAt: row.company_signed_at,
    partnerSignedAt: row.partner_signed_at,
  });
}

// POST /api/sign/[token] — partner submits their signature.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    signature?: string;
    signer_name?: string;
  };
  const signature = body.signature?.trim();
  if (!signature || !signature.startsWith("data:image")) {
    return NextResponse.json({ error: "Firma requerida" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("growth_partners")
    .select("*")
    .eq("sign_token", token)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status === "completed") {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }
  if (!SIGNABLE.includes(row.status)) {
    return NextResponse.json(
      { error: "Este contrato todavía no está listo para firmar." },
      { status: 409 }
    );
  }

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "unknown";
  const now = new Date().toISOString();

  const { data: updated, error } = await admin
    .from("growth_partners")
    .update({
      partner_signature: signature,
      partner_signer_name: body.signer_name?.trim() || row.partner_legal_name,
      partner_signed_at: now,
      partner_ip: ip,
      partner_user_agent: ua,
      status: "completed",
      updated_at: now,
    })
    .eq("id", row.id)
    .in("status", SIGNABLE)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || "No se pudo firmar" },
      { status: 500 }
    );
  }

  await admin.from("growth_partner_audit").insert([
    { partner_id: row.id, event: "partner_signed", actor: "partner", ip, user_agent: ua },
    { partner_id: row.id, event: "completed", actor: "partner", ip, user_agent: ua },
  ]);

  try {
    await finalizeContract(admin, updated);
  } catch {
    // PDF generation/upload failed — the signature is still recorded; the
    // final PDF can be regenerated on download.
  }

  return NextResponse.json({ ok: true });
}
