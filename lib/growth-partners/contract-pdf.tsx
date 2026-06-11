// Renders the Growth Partner agreement to a PDF Buffer (server-side).
// Stages: draft (no signatures) -> company signed -> both signed (+ certificate).

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { fillContract, type ContractFields, type Block, type Lang } from "./contract-template";

// Static PDF chrome (signature block, certificate) localized per language.
const LABELS: Record<Lang, {
  signatures: string; legalRep: string; panamaId: string; date: string;
  partner: string; name: string; brand: string; handle: string; document: string;
  certTitle: string; certSub: string; docName: string; doc: string; docId: string;
  hash: string; signer: string; dateTime: string; ip: string; device: string;
  dateLocale: string;
}> = {
  es: {
    signatures: "FIRMAS", legalRep: "Representante Legal",
    panamaId: "Identificación panameña: 8-713-1063", date: "Fecha",
    partner: "PARTNER", name: "Nombre", brand: "Empresa / Marca",
    handle: "Usuario / Handle", document: "Documento",
    certTitle: "CERTIFICADO DE FINALIZACIÓN",
    certSub: "Registro de firma electrónica · Peekr (Emanation Films, Inc.)",
    docName: "Founding Country Growth Partner Agreement",
    doc: "Documento", docId: "ID del documento", hash: "Hash (SHA-256)",
    signer: "Firmante", dateTime: "Fecha y hora", ip: "IP", device: "Dispositivo",
    dateLocale: "es-ES",
  },
  en: {
    signatures: "SIGNATURES", legalRep: "Legal Representative",
    panamaId: "Panamanian ID: 8-713-1063", date: "Date",
    partner: "PARTNER", name: "Name", brand: "Company / Brand",
    handle: "User / Handle", document: "Document",
    certTitle: "CERTIFICATE OF COMPLETION",
    certSub: "Electronic signature record · Peekr (Emanation Films, Inc.)",
    docName: "Founding Country Growth Partner Agreement",
    doc: "Document", docId: "Document ID", hash: "Hash (SHA-256)",
    signer: "Signatory", dateTime: "Date and time", ip: "IP", device: "Device",
    dateLocale: "en-US",
  },
  pt: {
    signatures: "ASSINATURAS", legalRep: "Representante Legal",
    panamaId: "Identificação panamenha: 8-713-1063", date: "Data",
    partner: "PARTNER", name: "Nome", brand: "Empresa / Marca",
    handle: "Usuário / Handle", document: "Documento",
    certTitle: "CERTIFICADO DE CONCLUSÃO",
    certSub: "Registro de assinatura eletrônica · Peekr (Emanation Films, Inc.)",
    docName: "Founding Country Growth Partner Agreement",
    doc: "Documento", docId: "ID do documento", hash: "Hash (SHA-256)",
    signer: "Signatário", dateTime: "Data e hora", ip: "IP", device: "Dispositivo",
    dateLocale: "pt-BR",
  },
};

export type SignData = {
  companySignature?: string | null; // data URL
  companySignedAt?: string | null;
  companyIp?: string | null;
  partnerSignature?: string | null;
  partnerSignedAt?: string | null;
  partnerIp?: string | null;
  partnerUserAgent?: string | null;
  documentId?: string | null;
  documentHash?: string | null;
};

const BRAND = "#FA0082";

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 66,
    paddingHorizontal: 48,
    fontSize: 9.5,
    lineHeight: 1.5,
    color: "#16161a",
    fontFamily: "Helvetica",
  },
  h1: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 4,
  },
  p: { marginBottom: 6, textAlign: "justify" },
  li: { marginBottom: 3, marginLeft: 12, textAlign: "justify" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    fontSize: 7.5,
    color: "#9a9a9a",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  initialsRow: { flexDirection: "row", alignItems: "flex-end" },
  initialBox: { flexDirection: "row", alignItems: "center", marginRight: 14 },
  initialLabel: { fontSize: 6, color: "#b0b0b0", marginRight: 3, marginBottom: 2 },
  initialImg: { height: 16, width: 44, objectFit: "contain" },
  sigSection: { marginTop: 22 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  sigBlock: { width: "47%" },
  sigLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 24 },
  sigImg: { height: 46, marginBottom: 2, objectFit: "contain" },
  sigLine: { borderTopWidth: 1, borderTopColor: "#16161a", marginBottom: 4, height: 0 },
  sigName: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  sigMeta: { fontSize: 8, color: "#555" },
  certTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    marginBottom: 4,
  },
  certSub: { fontSize: 9, color: "#666", marginBottom: 16 },
  certRow: { flexDirection: "row", marginBottom: 4 },
  certKey: { width: 150, color: "#666", fontSize: 9 },
  certVal: { flex: 1, fontSize: 9 },
  certParty: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 14, marginBottom: 4 },
});

function fmtDate(iso?: string | null, loc: string = "es-ES"): string {
  if (!iso) return "_____________________";
  try {
    const d = new Date(iso);
    return d.toLocaleString(loc, {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function renderBlock(b: Block, i: number) {
  if (b.t === "h1") return <Text key={i} style={s.h1}>{b.x}</Text>;
  if (b.t === "h2") return <Text key={i} style={s.h2}>{b.x}</Text>;
  if (b.t === "li") return <Text key={i} style={s.li}>{`•  ${b.x}`}</Text>;
  return <Text key={i} style={s.p}>{b.x}</Text>;
}

function Footer({ sign }: { sign?: SignData }) {
  return (
    <View style={s.footer} fixed>
      {/* Per-page initials: each party's signature, stamped small bottom-left. */}
      <View style={s.initialsRow}>
        {sign?.companySignature ? (
          <View style={s.initialBox}>
            <Text style={s.initialLabel}>Peekr</Text>
            <Image src={sign.companySignature} style={s.initialImg} />
          </View>
        ) : null}
        {sign?.partnerSignature ? (
          <View style={s.initialBox}>
            <Text style={s.initialLabel}>Partner</Text>
            <Image src={sign.partnerSignature} style={s.initialImg} />
          </View>
        ) : null}
      </View>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function ContractDoc({
  fields,
  sign,
}: {
  fields: ContractFields;
  sign?: SignData;
}) {
  const blocks = fillContract(fields);
  const bothSigned = !!(sign?.companySignedAt && sign?.partnerSignedAt);
  const lang: Lang = fields.language ?? "es";
  const L = LABELS[lang];

  return (
    <Document
      title={`Growth Partner Agreement - ${fields.country} - ${fields.partnerName}`}
    >
      <Page size="A4" style={s.page}>
        {blocks.map(renderBlock)}

        <View style={s.sigSection} wrap={false}>
          <Text style={s.h2}>{L.signatures}</Text>
          <View style={s.sigRow}>
            {/* Company */}
            <View style={s.sigBlock}>
              <Text style={s.sigLabel}>EMANATION FILMS, INC.</Text>
              {sign?.companySignature ? (
                <Image src={sign.companySignature} style={s.sigImg} />
              ) : (
                <View style={s.sigLine} />
              )}
              <View style={s.sigLine} />
              <Text style={s.sigName}>JORGE ENRIQUE MARTINELLI REMOND</Text>
              <Text style={s.sigMeta}>{L.legalRep}</Text>
              <Text style={s.sigMeta}>{L.panamaId}</Text>
              <Text style={s.sigMeta}>DUNS Number: 727265117</Text>
              <Text style={s.sigMeta}>{L.date}: {fmtDate(sign?.companySignedAt, L.dateLocale)}</Text>
            </View>

            {/* Partner */}
            <View style={s.sigBlock}>
              <Text style={s.sigLabel}>{L.partner}</Text>
              {sign?.partnerSignature ? (
                <Image src={sign.partnerSignature} style={s.sigImg} />
              ) : (
                <View style={s.sigLine} />
              )}
              <View style={s.sigLine} />
              <Text style={s.sigName}>{L.name}: {fields.partnerName}</Text>
              <Text style={s.sigMeta}>
                {L.brand}: {fields.brandName || fields.partnerName}
              </Text>
              <Text style={s.sigMeta}>{L.handle}: {fields.username}</Text>
              <Text style={s.sigMeta}>
                {L.document}: {fields.docNumber || "____________"}
                {fields.docCountry ? ` (${fields.docCountry})` : ""}
              </Text>
              <Text style={s.sigMeta}>{L.date}: {fmtDate(sign?.partnerSignedAt, L.dateLocale)}</Text>
            </View>
          </View>
        </View>

        <Footer sign={sign} />
      </Page>

      {bothSigned && (
        <Page size="A4" style={s.page}>
          <Text style={s.certTitle}>{L.certTitle}</Text>
          <Text style={s.certSub}>{L.certSub}</Text>

          <View style={s.certRow}>
            <Text style={s.certKey}>{L.doc}</Text>
            <Text style={s.certVal}>
              {L.docName} — {fields.country}
            </Text>
          </View>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.docId}</Text>
            <Text style={s.certVal}>{sign?.documentId || "—"}</Text>
          </View>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.hash}</Text>
            <Text style={s.certVal}>{sign?.documentHash || "—"}</Text>
          </View>

          <Text style={s.certParty}>EMANATION FILMS, INC.</Text>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.signer}</Text>
            <Text style={s.certVal}>Jorge Enrique Martinelli Remond</Text>
          </View>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.dateTime}</Text>
            <Text style={s.certVal}>{fmtDate(sign?.companySignedAt, L.dateLocale)}</Text>
          </View>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.ip}</Text>
            <Text style={s.certVal}>{sign?.companyIp || "—"}</Text>
          </View>

          <Text style={s.certParty}>{L.partner}</Text>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.signer}</Text>
            <Text style={s.certVal}>
              {fields.partnerName} ({fields.username})
            </Text>
          </View>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.dateTime}</Text>
            <Text style={s.certVal}>{fmtDate(sign?.partnerSignedAt, L.dateLocale)}</Text>
          </View>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.ip}</Text>
            <Text style={s.certVal}>{sign?.partnerIp || "—"}</Text>
          </View>
          <View style={s.certRow}>
            <Text style={s.certKey}>{L.device}</Text>
            <Text style={s.certVal}>{sign?.partnerUserAgent || "—"}</Text>
          </View>

          <Footer sign={sign} />
        </Page>
      )}
    </Document>
  );
}

export async function renderContractPdf(
  fields: ContractFields,
  sign?: SignData
): Promise<Buffer> {
  const buf = await renderToBuffer(<ContractDoc fields={fields} sign={sign} />);
  return buf as Buffer;
}
