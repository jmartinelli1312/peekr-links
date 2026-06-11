"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BRAND = "#FA0082";

type Meta = {
  country: string;
  partnerName: string;
  brandName: string | null;
  username: string;
  percentage: number;
  status: string;
  signable: boolean;
  completed: boolean;
};

export default function SignClient({ token }: { token: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sign/${token}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const j = (await res.json()) as Meta;
      setMeta(j);
      setName(j.partnerName || "");
      if (j.completed) setDone(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // signature pad setup
  useEffect(() => {
    if (!meta?.signable || done) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [meta?.signable, done]);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };

  const submit = async () => {
    if (!dirty.current) {
      alert("Dibujá tu firma primero.");
      return;
    }
    if (!accepted) {
      alert("Marcá que leíste y aceptás los términos.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: canvasRef.current!.toDataURL("image/png"),
          signer_name: name,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error || "No se pudo firmar");
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 26, fontWeight: 900, color: BRAND, letterSpacing: "-0.04em" }}>
          Peekr
        </div>

        {loading ? (
          <p style={{ color: "#999", marginTop: 20 }}>Cargando…</p>
        ) : notFound ? (
          <p style={{ color: "#bbb", marginTop: 20 }}>
            Enlace inválido o vencido.
          </p>
        ) : !meta ? null : (
          <>
            <h1 style={h1}>
              Founding Country Growth Partner — {meta.country}
            </h1>
            <p style={sub}>
              <strong style={{ color: "#fff" }}>{meta.partnerName}</strong>
              {meta.username ? ` · ${meta.username}` : ""} ·{" "}
              {Number(meta.percentage).toFixed(2)}%
            </p>

            <a
              href={`/api/sign/${token}/pdf`}
              target="_blank"
              rel="noreferrer"
              style={btnGhost}
            >
              📄 Ver el contrato completo (PDF)
            </a>

            <iframe
              src={`/api/sign/${token}/pdf`}
              style={{
                width: "100%",
                height: 420,
                border: "1px solid #ffffff1f",
                borderRadius: 12,
                marginTop: 14,
                background: "#fff",
              }}
              title="Contrato"
            />

            {done ? (
              <div style={{ marginTop: 22 }}>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "rgba(34,197,94,0.14)",
                    color: "#22c55e",
                    fontWeight: 700,
                  }}
                >
                  ✓ Contrato firmado por ambas partes.
                </div>
                <a
                  href={`/api/sign/${token}/final`}
                  style={{ ...btnPrimary, marginTop: 16, display: "inline-block" }}
                >
                  Descargar contrato firmado (PDF)
                </a>
                <p style={{ color: "#888", fontSize: 13, marginTop: 12 }}>
                  Podés imprimirlo o guardarlo. Una copia queda registrada en Peekr.
                </p>
              </div>
            ) : !meta.signable ? (
              <p style={{ color: "#f0a020", marginTop: 22, fontWeight: 600 }}>
                El contrato todavía no fue firmado por Peekr. Te avisaremos cuando
                esté listo para tu firma.
              </p>
            ) : (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 13, color: "#9a9a9a", marginBottom: 6 }}>
                  Tu firma
                </div>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  onPointerDown={(e) => {
                    drawing.current = true;
                    const ctx = canvasRef.current!.getContext("2d")!;
                    const p = pos(e);
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                  }}
                  onPointerMove={(e) => {
                    if (!drawing.current) return;
                    const ctx = canvasRef.current!.getContext("2d")!;
                    const p = pos(e);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                    dirty.current = true;
                  }}
                  onPointerUp={() => (drawing.current = false)}
                  onPointerLeave={() => (drawing.current = false)}
                  style={{
                    width: "100%",
                    height: 170,
                    borderRadius: 10,
                    border: "1px solid #ffffff2a",
                    background: "#fff",
                    touchAction: "none",
                    cursor: "crosshair",
                  }}
                />
                <button
                  onClick={() => {
                    const c = canvasRef.current!;
                    const ctx = c.getContext("2d")!;
                    ctx.fillStyle = "#fff";
                    ctx.fillRect(0, 0, c.width, c.height);
                    dirty.current = false;
                  }}
                  style={{ ...btnGhost, marginTop: 8 }}
                >
                  Limpiar
                </button>

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    marginTop: 16,
                    fontSize: 14,
                    color: "#ddd",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    He leído y acepto los términos del presente Founding Country
                    Growth Partner Agreement, y firmo electrónicamente con
                    fuerza vinculante.
                  </span>
                </label>

                <button
                  onClick={submit}
                  disabled={submitting}
                  style={{ ...btnPrimary, marginTop: 18, opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Firmando…" : "Firmar contrato"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0B0B0F",
  color: "#eaeaea",
  padding: "32px 16px 64px",
  display: "flex",
  justifyContent: "center",
};
const card: React.CSSProperties = { width: "100%", maxWidth: 640 };
const h1: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  margin: "18px 0 6px",
};
const sub: React.CSSProperties = { color: "#9a9a9a", fontSize: 14, marginBottom: 18 };
const btnPrimary: React.CSSProperties = {
  background: BRAND,
  color: "#fff",
  border: "none",
  borderRadius: 999,
  padding: "13px 26px",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  textDecoration: "none",
};
const btnGhost: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 999,
  padding: "10px 18px",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  cursor: "pointer",
};
