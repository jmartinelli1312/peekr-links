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
import { dashTexts } from "./texts";

type Gate = "loading" | "ok" | "denied";
type TabKey = "country" | "titles";

function normalizeLang(value?: string): Lang {
  const raw = (value || "es").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("pt")) return "pt";
  return "es";
}

const PRESETS: Array<Exclude<Preset, "custom">> = ["today", "yesterday", "7d", "30d", "90d"];

export default function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = use(params);
  const lang = normalizeLang(rawLang);
  const t = dashTexts(lang);
  const router = useRouter();

  const presetLabel = (p: Exclude<Preset, "custom">): string =>
    ({ today: t.presetToday, yesterday: t.presetYesterday, "7d": t.preset7d, "30d": t.preset30d, "90d": t.preset90d }[p]);

  const [gate, setGate] = useState<Gate>("loading");
  const [country, setCountry] = useState<string>("");          // the viewer's own/default country
  const [selectedCountry, setSelectedCountry] = useState<string>(""); // active selection
  const [isAdmin, setIsAdmin] = useState(false);
  const [countryOptions, setCountryOptions] = useState<{ country_code: string; users: number | null }[]>([]);
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
      // A creator/partner may own several country dashboards now. Fetch all of
      // them; the country selector (fed by creator_dashboard_country_options)
      // lets multi-country owners switch between their markets.
      const { data, error } = await supabase
        .from("creator_dashboards")
        .select("country_code")
        .eq("user_id", session.user.id)
        .eq("enabled", true);
      if (!mounted) return;
      const owned = (data ?? [])
        .map((r) => String(r.country_code).toUpperCase())
        .sort();
      if (error || owned.length === 0) {
        setGate("denied");
        router.replace(`/${lang}`);
        return;
      }
      const own = owned[0];
      setCountry(own);
      setSelectedCountry(own);
      setGate("ok");

      // Admins get a country selector to view any market; everyone else is
      // locked to the country(ies) they actually own.
      const [{ data: prof }, { data: opts }] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle(),
        supabase.rpc("creator_dashboard_country_options"),
      ]);
      if (!mounted) return;
      setIsAdmin(!!(prof as { is_admin?: boolean } | null)?.is_admin);
      setCountryOptions(
        Array.isArray(opts) ? (opts as { country_code: string; users: number | null }[]) : []
      );
    })();
    return () => {
      mounted = false;
    };
  }, [router, lang]);

  if (gate !== "ok") {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.55)" }}>
        {gate === "loading" ? t.loading : t.denied}
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
        {isAdmin || countryOptions.length > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{t.metricsFor}</span>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 8,
                color: "#fff",
                padding: "6px 10px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isAdmin && (
                <option value="ALL" style={{ color: "#000" }}>
                  🌎 {lang === "en" ? "All countries" : lang === "pt" ? "Todos os países" : "Todos los países"}
                </option>
              )}
              {countryOptions.map((o) => (
                <option key={o.country_code} value={o.country_code} style={{ color: "#000" }}>
                  {countryName(o.country_code)}
                  {o.users != null ? ` (${o.users.toLocaleString()})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
            {t.metricsFor} <strong style={{ color: "rgba(255,255,255,0.9)" }}>{countryName(country)}</strong>
          </p>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button style={pill(tab === "country")} onClick={() => setTab("country")}>
          {t.tabCountry}
        </button>
        <button style={pill(tab === "titles")} onClick={() => setTab("titles")}>
          {t.tabTitles}
        </button>
      </div>

      {/* Date filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 22 }}>
        {PRESETS.map((p) => (
          <button key={p} style={pill(preset === p)} onClick={() => setPreset(p)}>
            {presetLabel(p)}
          </button>
        ))}
        <button style={pill(preset === "custom")} onClick={() => setPreset("custom")}>
          {t.custom}
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
            title={t.onlyOnboardedTip}
          >
            {onlyOnboarded ? "✓ " : ""}{t.onlyOnboarded}
          </button>
        )}
      </div>

      {tab === "country" ? (
        <CountryMetricsTab supabase={supabase} range={range} onlyOnboarded={onlyOnboarded} lang={lang} country={selectedCountry} />
      ) : (
        <TitlesTab supabase={supabase} range={range} lang={lang} country={selectedCountry} preset={preset} />
      )}
    </div>
  );
}
