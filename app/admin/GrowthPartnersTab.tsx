"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";

type Contract = {
  id: string;
  country: string;
  partner_legal_name: string;
  brand_name: string | null;
  username: string;
  percentage: number;
  effective_date: string | null;
  status: string;
  language: string | null;
  company_signed_at: string | null;
  partner_signed_at: string | null;
  partner_email: string | null;
  sign_token: string | null;
  final_pdf_path: string | null;
  created_at: string;
};

const LANG_LABEL: Record<string, string> = { es: "Español", en: "Inglés", pt: "Portugués" };

function fmtSignedDate(c: Contract): string {
  const iso = c.partner_signed_at || c.company_signed_at;
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  draft: { t: "Borrador", c: "#9a9a9a" },
  company_signed: { t: "Firmado por Peekr", c: "#f0a020" },
  sent: { t: "Enviado al partner", c: "#3b82f6" },
  completed: { t: "Completado", c: "#22c55e" },
  void: { t: "Anulado", c: "#ef4444" },
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function GrowthPartnersTab() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState<Contract | null>(null);

  const [form, setForm] = useState({
    country: "Argentina",
    partner_legal_name: "",
    brand_name: "",
    username: "",
    percentage: "5",
    effective_date: "",
    partner_email: "",
    partner_doc_number: "",
    partner_doc_country: "Argentina",
    language: "es",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/growth-partners", {
        headers: await authHeaders(),
      });
      const j = await res.json();
      setContracts(j.contracts ?? []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/growth-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          ...form,
          percentage: Number(form.percentage),
          effective_date: form.effective_date || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error || "Error al crear");
        return;
      }
      setShowForm(false);
      setForm({
        country: "Argentina",
        partner_legal_name: "",
        brand_name: "",
        username: "",
        percentage: "5",
        effective_date: "",
        partner_email: "",
        partner_doc_number: "",
        partner_doc_country: "Argentina",
        language: "es",
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const viewPdf = async (id: string) => {
    const res = await fetch(`/api/admin/growth-partners/${id}/pdf`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      alert("No se pudo generar el PDF");
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  };

  const signCompany = async (id: string, signature: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/growth-partners/${id}/sign-company`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ signature }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error || "Error al firmar");
        return;
      }
      setSigning(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/growth-partners/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ confirm: "ELIMINAR" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.error || "Error al eliminar");
        return;
      }
      setDeleting(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copyLink = (token: string | null) => {
    if (!token) return;
    const url = `${window.location.origin}/sign/${token}`;
    navigator.clipboard.writeText(url);
    alert("Link de firma copiado:\n" + url);
  };

  // Group by country for the summary.
  const countries = Array.from(new Set(contracts.map((c) => c.country))).sort();

  return (
    <div style={{ color: "#eee" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Growth Partners</h2>
        <button onClick={() => setShowForm((v) => !v)} style={btnPrimary}>
          {showForm ? "Cancelar" : "+ Nuevo contrato"}
        </button>
      </div>

      {showForm && (
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="País" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            <Field label="% participación" value={form.percentage} onChange={(v) => setForm({ ...form, percentage: v })} />
            <Field label="Nombre legal del partner" value={form.partner_legal_name} onChange={(v) => setForm({ ...form, partner_legal_name: v })} />
            <Field label="Empresa / Marca" value={form.brand_name} onChange={(v) => setForm({ ...form, brand_name: v })} />
            <Field label="Usuario / Handle" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
            <Field label="N° de documento" value={form.partner_doc_number} onChange={(v) => setForm({ ...form, partner_doc_number: v })} />
            <Field label="País del documento" value={form.partner_doc_country} onChange={(v) => setForm({ ...form, partner_doc_country: v })} />
            <Field label="Email del partner" value={form.partner_email} onChange={(v) => setForm({ ...form, partner_email: v })} />
            <Field label="Fecha de vigencia" value={form.effective_date} onChange={(v) => setForm({ ...form, effective_date: v })} type="date" />
            <SelectField
              label="Idioma del contrato"
              value={form.language}
              onChange={(v) => setForm({ ...form, language: v })}
              options={[
                { value: "es", label: "Español" },
                { value: "en", label: "Inglés" },
                { value: "pt", label: "Portugués" },
              ]}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <button onClick={create} disabled={busy} style={btnPrimary}>
              {busy ? "Creando…" : "Crear contrato"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Cargando…</p>
      ) : contracts.length === 0 ? (
        <p style={{ color: "#888" }}>Todavía no hay contratos. Creá el primero.</p>
      ) : (
        countries.map((country) => {
          const rows = contracts.filter((c) => c.country === country);
          const allocated = rows
            .filter((r) => r.status !== "void")
            .reduce((s, r) => s + Number(r.percentage), 0);
          return (
            <div key={country} style={{ marginBottom: 26 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{country}</h3>
                <span style={{ color: "#9a9a9a", fontSize: 13 }}>
                  {allocated.toFixed(2)}% asignado · {(100 - allocated).toFixed(2)}% disponible
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ color: "#9a9a9a", textAlign: "left" }}>
                      <th style={th}>Partner</th>
                      <th style={th}>Usuario</th>
                      <th style={th}>%</th>
                      <th style={th}>Estado</th>
                      <th style={th}>Firmado</th>
                      <th style={th}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => {
                      const st = STATUS_LABEL[c.status] ?? { t: c.status, c: "#9a9a9a" };
                      return (
                        <tr key={c.id} style={{ borderTop: "1px solid #ffffff14" }}>
                          <td style={td}>
                            {c.partner_legal_name}
                            <div style={{ color: "#7a7a7a", fontSize: 11, marginTop: 2 }}>
                              {LANG_LABEL[c.language ?? "es"] ?? "Español"}
                            </div>
                          </td>
                          <td style={td}>{c.username}</td>
                          <td style={td}>{Number(c.percentage).toFixed(2)}%</td>
                          <td style={td}>
                            <span style={{ color: st.c, fontWeight: 700 }}>{st.t}</span>
                          </td>
                          <td style={{ ...td, whiteSpace: "nowrap", color: "#bdbdbd", fontSize: 13 }}>
                            {fmtSignedDate(c)}
                          </td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>
                            <button style={btnGhost} onClick={() => viewPdf(c.id)}>PDF</button>
                            {c.status === "draft" || c.status === "company_signed" ? (
                              <button style={btnGhost} onClick={() => setSigning(c)}>
                                Firmar como Peekr
                              </button>
                            ) : null}
                            {c.status === "company_signed" && (
                              <button style={btnGhost} onClick={() => copyLink(c.sign_token)}>
                                Copiar link partner
                              </button>
                            )}
                            <button style={btnDanger} onClick={() => setDeleting(c)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {signing && (
        <SignModal
          contract={signing}
          busy={busy}
          onCancel={() => setSigning(null)}
          onSign={(sig) => signCompany(signing.id, sig)}
        />
      )}

      {deleting && (
        <DeleteModal
          contract={deleting}
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove(deleting.id)}
        />
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: "block", fontSize: 12, color: "#9a9a9a" }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          marginTop: 4,
          padding: "8px 10px",
          background: "#15151b",
          border: "1px solid #ffffff22",
          borderRadius: 8,
          color: "#fff",
          fontSize: 14,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── Delete confirmation modal (type ELIMINAR) ───────────────────────────────
function DeleteModal({
  contract,
  busy,
  onCancel,
  onConfirm,
}: {
  contract: Contract;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [text, setText] = useState("");
  const ok = text.trim().toUpperCase() === "ELIMINAR";
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={{ ...card, maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: "#ff6b6b" }}>Eliminar contrato</h3>
        <p style={{ color: "#cfcfcf", fontSize: 14, lineHeight: 1.5 }}>
          Vas a eliminar permanentemente el contrato de{" "}
          <strong>{contract.partner_legal_name}</strong> ({contract.username}) ·{" "}
          {contract.country} · {Number(contract.percentage).toFixed(2)}%.
          <br />
          Esta acción no se puede deshacer y borra también el PDF firmado.
        </p>
        <p style={{ color: "#9a9a9a", fontSize: 13, marginBottom: 6 }}>
          Para confirmar, escribí <strong style={{ color: "#fff" }}>ELIMINAR</strong>:
        </p>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ELIMINAR"
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "#15151b",
            border: `1px solid ${ok ? "#ff6b6b" : "#ffffff22"}`,
            borderRadius: 8,
            color: "#fff",
            fontSize: 15,
            letterSpacing: 1,
          }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1 }} />
          <button style={btnGhost} onClick={onCancel}>Cancelar</button>
          <button
            style={{ ...btnDanger, opacity: ok && !busy ? 1 : 0.45, cursor: ok && !busy ? "pointer" : "not-allowed", marginRight: 0 }}
            onClick={onConfirm}
            disabled={!ok || busy}
          >
            {busy ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label style={{ display: "block", fontSize: 12, color: "#9a9a9a" }}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          marginTop: 4,
          padding: "8px 10px",
          background: "#15151b",
          border: "1px solid #ffffff22",
          borderRadius: 8,
          color: "#fff",
          fontSize: 14,
        }}
      />
    </label>
  );
}

// ── Signature pad modal ─────────────────────────────────────────────────────
function SignModal({
  contract,
  busy,
  onCancel,
  onSign,
}: {
  contract: Contract;
  busy: boolean;
  onCancel: () => void;
  onSign: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty.current = true;
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    dirty.current = false;
  };
  const confirm = () => {
    if (!dirty.current) {
      alert("Dibujá tu firma primero.");
      return;
    }
    onSign(canvasRef.current!.toDataURL("image/png"));
  };

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={{ ...card, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Firmar como Peekr</h3>
        <p style={{ color: "#9a9a9a", fontSize: 13 }}>
          {contract.country} · {contract.partner_legal_name} ({contract.username}) · {Number(contract.percentage).toFixed(2)}%
        </p>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          style={{ width: "100%", height: 180, borderRadius: 10, border: "1px solid #ffffff22", touchAction: "none", cursor: "crosshair" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button style={btnGhost} onClick={clear}>Limpiar</button>
          <div style={{ flex: 1 }} />
          <button style={btnGhost} onClick={onCancel}>Cancelar</button>
          <button style={btnPrimary} onClick={confirm} disabled={busy}>
            {busy ? "Firmando…" : "Firmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#101015",
  border: "1px solid #ffffff14",
  borderRadius: 14,
  padding: 18,
  marginBottom: 22,
};
const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 700, fontSize: 12 };
const td: React.CSSProperties = { padding: "10px 10px", color: "#eaeaea" };
const btnPrimary: React.CSSProperties = {
  background: BRAND,
  color: "#fff",
  border: "none",
  borderRadius: 999,
  padding: "9px 18px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "#eaeaea",
  border: "1px solid #ffffff22",
  borderRadius: 999,
  padding: "6px 12px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  marginRight: 6,
};
const btnDanger: React.CSSProperties = {
  background: "rgba(239,68,68,0.12)",
  color: "#ff6b6b",
  border: "1px solid rgba(239,68,68,0.4)",
  borderRadius: 999,
  padding: "6px 12px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  marginRight: 6,
};
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};
