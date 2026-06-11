import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin, clientIp } from "@/lib/growth-partners/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/growth-partners — list all contracts (newest first).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const { data, error } = await admin
    .from("growth_partners")
    .select(
      "id, country, partner_legal_name, brand_name, username, percentage, effective_date, status, language, company_signed_at, partner_signed_at, partner_email, sign_token, final_pdf_path, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contracts: data ?? [] });
}

// POST /api/admin/growth-partners — create a new contract (draft).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const country = String(body.country ?? "").trim();
  const partnerName = String(body.partner_legal_name ?? "").trim();
  const username = String(body.username ?? "").trim();
  const brandName = String(body.brand_name ?? "").trim();
  const percentage = Number(body.percentage);
  const effectiveDate = body.effective_date
    ? String(body.effective_date)
    : null;
  const partnerEmail = body.partner_email
    ? String(body.partner_email).trim()
    : null;
  const docNumber = body.partner_doc_number
    ? String(body.partner_doc_number).trim()
    : null;
  const docCountry = body.partner_doc_country
    ? String(body.partner_doc_country).trim()
    : null;
  const language = ["es", "en", "pt"].includes(String(body.language))
    ? String(body.language)
    : "es";

  if (!country || !partnerName || !username || !Number.isFinite(percentage)) {
    return NextResponse.json(
      { error: "country, partner_legal_name, username y percentage son requeridos" },
      { status: 400 }
    );
  }

  const token = randomBytes(24).toString("base64url");

  const { data, error } = await admin
    .from("growth_partners")
    .insert({
      country,
      partner_legal_name: partnerName,
      brand_name: brandName || null,
      username,
      percentage,
      effective_date: effectiveDate,
      partner_email: partnerEmail,
      partner_doc_number: docNumber,
      partner_doc_country: docCountry,
      language,
      status: "draft",
      sign_token: token,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("growth_partner_audit").insert({
    partner_id: data.id,
    event: "created",
    actor: "company",
    ip: clientIp(req),
    meta: { percentage, country },
  });

  return NextResponse.json({ contract: data });
}
