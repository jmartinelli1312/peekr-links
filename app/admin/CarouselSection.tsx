"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Compact per-article embedded carousel control.
 *
 * Responsibilities (intentionally narrow):
 *   1. Show whether a carousel exists for this article and its current status.
 *   2. Trigger generation of a first draft.
 *   3. Point the editor to the dedicated "Carruseles generados" section below
 *      for the full preview / actions (approve, regenerate, skip, download).
 *
 * Heavy UI — 10-slide grid, ZIP download, publish button — lives in
 * CarouselsGeneratedSection. Keeping this embedded view small avoids cluttering
 * each article card and keeps the action surface in one predictable place.
 */

interface CarouselRow {
  id: number;
  version: number;
  status: "draft" | "discarded" | "skipped" | "approved" | "published" | "failed";
  category: string | null;
}

const STATUS_LABEL: Record<CarouselRow["status"], string> = {
  draft: "Borrador",
  discarded: "Descartado",
  skipped: "No publicar",
  approved: "En cola",
  published: "Publicado",
  failed: "Falló",
};

export default function CarouselSection({
  supabase,
  articleId,
  refreshKey,
  onChanged,
}: {
  supabase: SupabaseClient;
  articleId: number;
  /** Bump from parent to force a reload (e.g. after dedicated section actions). */
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const [carousel, setCarousel] = useState<CarouselRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchErr } = await supabase
      .from("peekrbuzz_carousels")
      .select("id, version, status, category")
      .eq("article_id", articleId)
      .neq("status", "discarded")
      .order("version", { ascending: false })
      .limit(1);

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setCarousel(((data ?? [])[0] as CarouselRow | undefined) ?? null);
    }
    setLoading(false);
  }, [supabase, articleId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");

      const res = await fetch("/api/admin/peekrbuzz/carousels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ article_id: articleId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px dashed rgba(255,255,255,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
        <span style={{ fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
          Carrusel IG/FB
        </span>
        {loading ? (
          <span style={{ color: "rgba(255,255,255,0.4)" }}>cargando…</span>
        ) : carousel ? (
          <>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 10,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                background:
                  carousel.status === "published" ? "rgba(34,197,94,0.18)" :
                  carousel.status === "approved"  ? "rgba(34,197,94,0.12)" :
                  carousel.status === "failed"    ? "rgba(239,68,68,0.15)" :
                  carousel.status === "skipped"   ? "rgba(255,255,255,0.06)" :
                  "rgba(245,158,11,0.15)",
                color:
                  carousel.status === "published" ? "#4ade80" :
                  carousel.status === "approved"  ? "#86efac" :
                  carousel.status === "failed"    ? "#fca5a5" :
                  carousel.status === "skipped"   ? "rgba(255,255,255,0.55)" :
                  "#fcd34d",
                border: "1px solid",
                borderColor:
                  carousel.status === "published" ? "rgba(34,197,94,0.5)" :
                  carousel.status === "approved"  ? "rgba(34,197,94,0.4)" :
                  carousel.status === "failed"    ? "rgba(239,68,68,0.4)" :
                  carousel.status === "skipped"   ? "rgba(255,255,255,0.15)" :
                  "rgba(245,158,11,0.4)",
              }}
            >
              {STATUS_LABEL[carousel.status]}
            </span>
            <span style={{ color: "rgba(255,255,255,0.45)" }}>v{carousel.version}</span>
            {carousel.category && <span style={{ color: "rgba(255,255,255,0.55)" }}>· {carousel.category}</span>}
          </>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.4)" }}>sin generar</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {!loading && !carousel && (
          <button
            onClick={generate}
            disabled={busy}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: "#FA0082",
              border: "1px solid #FA0082",
              color: "white",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Generando…" : "Generar carrusel"}
          </button>
        )}
        {!loading && carousel && (
          <a
            href="#carruseles-generados"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "rgba(255,255,255,0.85)",
              textDecoration: "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              // The default anchor jump handles scrolling.
            }}
          >
            Ver abajo ↓
          </a>
        )}
      </div>

      {error && (
        <div
          style={{
            width: "100%",
            marginTop: 6,
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 11,
            color: "#fca5a5",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
