import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderContractPdf } from "./contract-pdf";
import { rowToFields, rowToSign } from "./from-row";

const BUCKET = "growth-partner-contracts";

// Hash of the signing RECORD (not the PDF bytes) — stable, tamper-evident,
// and avoids the certificate-page chicken-and-egg.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function signingHash(row: any): string {
  const payload = JSON.stringify({
    id: row.id,
    country: row.country,
    partnerName: row.partner_legal_name,
    brand: row.brand_name,
    username: row.username,
    percentage: row.percentage,
    effective_date: row.effective_date,
    company: {
      name: "Jorge Enrique Martinelli Remond",
      at: row.company_signed_at,
      ip: row.company_ip,
      sig: row.company_signature,
    },
    partner: {
      name: row.partner_signer_name,
      at: row.partner_signed_at,
      ip: row.partner_ip,
      ua: row.partner_user_agent,
      sig: row.partner_signature,
    },
  });
  return createHash("sha256").update(payload).digest("hex");
}

// Renders the final (both-signed) PDF with the certificate + hash, uploads it
// to the private bucket, and records the path + hash on the row.
export async function finalizeContract(
  admin: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
): Promise<{ path: string; hash: string }> {
  const hash = signingHash(row);
  const sign = { ...rowToSign(row), documentHash: hash };
  const pdf = await renderContractPdf(rowToFields(row), sign);

  const safeUser = String(row.username || "partner").replace(/[^a-zA-Z0-9_.-]/g, "");
  const path = `${row.id}/${safeUser}-signed.pdf`;

  await admin.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });

  await admin
    .from("growth_partners")
    .update({
      final_pdf_path: path,
      document_hash: hash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return { path, hash };
}

export async function downloadFinalPdf(
  admin: SupabaseClient,
  path: string
): Promise<Uint8Array | null> {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buf = await data.arrayBuffer();
  return new Uint8Array(buf);
}
