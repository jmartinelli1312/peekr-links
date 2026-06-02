"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CountryMetricsTab from "./CountryMetricsTab";
import TitlesTab from "./TitlesTab";
import {
  BRAND,
  countryName,
  Lang,
  Preset,
  presetRange,
  todayStr,
} from "./_shared";

type Gate = "loading" | "ok" | "denied";
type TabKey = "country" | "titles";

function normalizeLang(value?: string): Lang {
  const raw = (value || "es").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("pt")) return "pt";
  return "es";
}

const PRESET_LABELS: Record<Exclude<Preset, "custom">, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
};

export default function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = use(params);
  const lang = normalizeLang(rawLang);
  const router = useRouter();

  const [gate, setGate] = useState<Gate>("loading");
  const [country, setCountry] = useState<string>("");
  const [tab, setTab] = useState<TabKey>("country");

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const [onlyOnboarded, setOnlyOnboarded] = useState(false);

  const range = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("creator_dashboards")
        .select("country_code")
        .eq("user_id", session.user.id)
        .eq("enabled", true)
        .maybeSingle();
      if (!mounted) return;
      if (error || !data) {
        setGate("denied");
        router.replace(`/${lang}`);
        return;
      }
      setCountry((data.country_code as string).toUpperCase());
      setGate("ok");
    })();
    return () => {
      mounted = false;
    };
  }, [router, lang]);

  if (gate !== "ok") {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.55)" }}>
        {gate === "loading" ? "Cargando…" : "Acceso no autorizado"}
      </div>
    );
  }

  const pill = (active: boolean): React.CSSProperties => ({
    background: active ? BRAND : "rgba(255,255,255,0.06)",
    color: active ? "#fff" : "rgba(255,255,255,0.7)",
    border: "1px solid " + (active ? BRAND : "rgba(255,255,255,0.12)"),
    borderRadius: 999,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Dashboard</h1>
        <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          Métricas de <strong style={{ color: "rgba(255,255,255,0.9)" }}>{countryName(country)}</strong>
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button style={pill(tab === "country")} onClick={() => setTab("country")}>
          Métricas del País
        </button>
        <button style={pill(tab === "titles")} onClick={() => setTab("titles")}>
          Métricas de Títulos
        </button>
      </div>

      {/* Date filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 22 }}>
        {(Object.keys(PRESET_LABELS) as Array<Exclude<Preset, "custom">>).map((p) => (
          <button key={p} style={pill(preset === p)} onClick={() => setPreset(p)}>
            {PRESET_LABELS[p]}
          </button>
        ))}
        <button style={pill(preset === "custom")} onClick={() => setPreset("custom")}>
          Personalizado
        </button>
        {preset === "custom" && (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "6px 8px", fontSize: 13 }}
            />
            <span style={{ color: "rgba(255,255,255,0.5)" }}>→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={todayStr()}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "6px 8px", fontSize: 13 }}
            />
          </span>
        )}

        {tab === "country" && (
          <button
            style={{ ...pill(onlyOnboarded), marginLeft: "auto" }}
            onClick={() => setOnlyOnboarded((v) => !v)}
            title="Considerar solo usuarios que completaron onboarding"
          >
            {onlyOnboarded ? "✓ " : ""}Solo onboarded
          </button>
        )}
      </div>

      {tab === "country" ? (
        <CountryMetricsTab supabase={supabase} range={range} onlyOnboarded={onlyOnboarded} />
      ) : (
        <TitlesTab supabase={supabase} range={range} lang={lang} />
      )}
    </div>
  );
}
