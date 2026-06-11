import type { ContractFields } from "./contract-template";
import type { SignData } from "./contract-pdf";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function formatEffectiveDate(d: string | null): string {
  if (!d) return "____________, 2026";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return d;
  return `${day} de ${MONTHS[m - 1]} de ${y}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToFields(row: any): ContractFields {
  return {
    country: row.country,
    effectiveDate: formatEffectiveDate(row.effective_date),
    partnerName: row.partner_legal_name,
    brandName: row.brand_name || row.partner_legal_name,
    username: row.username,
    percentage: Number(row.percentage),
    docNumber: row.partner_doc_number ?? undefined,
    docCountry: row.partner_doc_country ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToSign(row: any): SignData {
  return {
    companySignature: row.company_signature,
    companySignedAt: row.company_signed_at,
    companyIp: row.company_ip,
    partnerSignature: row.partner_signature,
    partnerSignedAt: row.partner_signed_at,
    partnerIp: row.partner_ip,
    partnerUserAgent: row.partner_user_agent,
    documentId: row.id,
    documentHash: row.document_hash,
  };
}
