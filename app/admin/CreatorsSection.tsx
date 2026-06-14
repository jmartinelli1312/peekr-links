"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";

type Creator = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  creator_status: string | null;
  in_onboarding: boolean;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function CreatorsSection() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/creators", { headers: await authHeaders() });
      const j = await res.json();
      setCreators(j.creators ?? []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (c: Creator) => {
    const next = !c.in_onboarding;
    setSavingId(c.id);
    // optimistic
    setCreators((list) => list.map((x) => (x.id === c.id ? { ...x, in_onboarding: next } : x)));
    try {
      const res = await fetch("/api/admin/creators/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ user_id: c.id, enabled: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Error al actualizar");
        setCreators((list) => list.map((x) => (x.id === c.id ? { ...x, in_onboarding: !next } : x)));
      }
    } catch {
      setCreators((list) => list.map((x) => (x.id === c.id ? { ...x, in_onboarding: !next } : x)));
    } finally {
      setSavingId(null);
    }
  };

  const onCount = creators.filter((c) => c.in_onboarding).length;

  return (
    <div style={{ color: "#eee", marginTop: 40, paddingTop: 24, borderTop: "1px solid #ffffff14" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Creators</h2>
      <p style={{ color: "#9a9a9a", fontSize: 13, margin: "0 0 16px" }}>
        Prendé o apagá la inclusión de cada creator en el <strong>silent onboarding</strong> (a los
        usuarios nuevos se les auto-sigue, en silencio, a los que estén prendidos).
        {!loading && ` · ${onCount} prendido${onCount === 1 ? "" : "s"} de ${creators.length}.`}
      </p>

      {loading ? (
        <p style={{ color: "#888" }}>Cargando creators…</p>
      ) : creators.length === 0 ? (
        <p style={{ color: "#888" }}>No hay creators.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {creators.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#101015",
                border: "1px solid #ffffff14",
                borderRadius: 12,
                padding: "10px 14px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.avatar_url || "/avatar-placeholder.png"}
                alt=""
                width={36}
                height={36}
                style={{ borderRadius: "50%", objectFit: "cover", background: "#222", flexShrink: 0 }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  @{c.username || "—"}
                  {c.creator_status && c.creator_status !== "approved" && (
                    <span style={{ color: "#f0a020", fontSize: 11, marginLeft: 8 }}>
                      ({c.creator_status})
                    </span>
                  )}
                </div>
                <div style={{ color: "#7a7a7a", fontSize: 12 }}>
                  {c.display_name || ""}
                  {c.country_code ? ` · ${c.country_code}` : ""}
                </div>
              </div>
              <Toggle on={c.in_onboarding} busy={savingId === c.id} onClick={() => toggle(c)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, busy, onClick }: { on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={on ? "Incluido en silent onboarding" : "No incluido"}
      style={{
        position: "relative",
        width: 46,
        height: 26,
        borderRadius: 999,
        border: "none",
        cursor: busy ? "wait" : "pointer",
        background: on ? BRAND : "#3a3a42",
        transition: "background 0.15s",
        flexShrink: 0,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}
