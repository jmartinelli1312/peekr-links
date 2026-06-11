import type { ContractFields, Lang } from "./contract-template";
import type { SignData } from "./contract-pdf";

const MONTHS: Record<Lang, string[]> = {
  es: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  pt: [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ],
};

export function formatEffectiveDate(d: string | null, lang: Lang = "es"): string {
  if (!d) return lang === "en" ? "____________, 2026" : "____________, 2026";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return d;
  // EN: "June 10, 2026" · ES/PT: "10 de junio de 2026" / "10 de junho de 2026"
  if (lang === "en") return `${MONTHS.en[m - 1]} ${day}, ${y}`;
  return `${day} de ${MONTHS[lang][m - 1]} de ${y}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToFields(row: any): ContractFields {
  const lang: Lang = (["es", "en", "pt"].includes(row.language) ? row.language : "es") as Lang;
  return {
    country: row.country,
    effectiveDate: formatEffectiveDate(row.effective_date, lang),
    partnerName: row.partner_legal_name,
    brandName: row.brand_name || row.partner_legal_name,
    username: row.username,
    percentage: Number(row.percentage),
    docNumber: row.partner_doc_number ?? undefined,
    docCountry: row.partner_doc_country ?? undefined,
    language: lang,
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
