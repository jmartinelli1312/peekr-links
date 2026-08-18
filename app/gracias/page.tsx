"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// Thank-you page for the 1-tap expectation survey. The Supabase edge function
// records the tapped answer, then 302-redirects here (its own HTML bodies are
// forced to text/plain by the runtime, so it can't render a page itself).

const ANSWERS: Record<string, string> = {
  free: "🎬 Ver películas/series gratis",
  discover: "🔍 Descubrir qué ver",
  social: "👥 Seguir amigos y creadores",
  other: "🤔 Otra cosa",
};

const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/expectation_survey`;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function Gracias() {
  const sp = useSearchParams();
  const a = sp.get("a") ?? "";
  const u = sp.get("u") ?? "";
  const [txt, setTxt] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!txt.trim() || !u || busy) return;
    setBusy(true);
    try {
      await fetch(`${FN}?apikey=${encodeURIComponent(ANON)}&u=${u}&extra=${encodeURIComponent(txt.trim())}`);
    } catch {
      /* best-effort */
    }
    setSent(true);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      }}
    >
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#FA0082", marginBottom: 20 }}>
          Peekr
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>¡Gracias! 🙏</div>
        {a && ANSWERS[a] && (
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, margin: "0 0 4px" }}>
            Anotamos: <b style={{ color: "#fff" }}>{ANSWERS[a]}</b>
          </p>
        )}

        {sent ? (
          <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 22, fontSize: 15 }}>
            Leí tu mensaje. De verdad ayuda muchísimo. — Jorge
          </p>
        ) : (
          <div style={{ marginTop: 24, textAlign: "left" }}>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
              ¿Quieres contarme más? (opcional)
            </div>
            <textarea
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              rows={3}
              placeholder="Escribe aquí…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#141414",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 12,
                color: "#fff",
                padding: 12,
                fontSize: 15,
                resize: "vertical",
              }}
            />
            <button
              onClick={submit}
              disabled={busy || !txt.trim()}
              style={{
                marginTop: 10,
                background: txt.trim() ? "#FA0082" : "#333",
                color: "#fff",
                border: "none",
                borderRadius: 99,
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 800,
                cursor: txt.trim() ? "pointer" : "default",
              }}
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Gracias />
    </Suspense>
  );
}
