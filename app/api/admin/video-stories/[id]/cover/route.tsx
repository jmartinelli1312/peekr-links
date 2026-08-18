/**
 * Cover art for a story — the Reddit-story card look.
 *
 * White card, the hook set as hero text with a few words punched out in
 * Peekr magenta, and a "Peekr Stories" lockup on top. Rendered with the same
 * ImageResponse engine the Peekrbuzz carousels already use.
 *
 *   GET /api/admin/video-stories/<id>/cover?format=tiktok|youtube
 *
 * tiktok  → 1080×1920 (vertical cover)
 * youtube → 1280×720  (thumbnail)
 */

import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAGENTA = "#FA0082";
const INK = "#0B0B0F";

const FORMATS = {
  tiktok: { width: 1080, height: 1920, hero: 78, brand: 40 },
  youtube: { width: 1280, height: 720, hero: 62, brand: 34 },
} as const;

type FormatKey = keyof typeof FORMATS;

const FONT_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files";

async function loadFonts() {
  const [regular, bold, black] = await Promise.all([
    fetch(`${FONT_BASE}/inter-latin-400-normal.woff`).then((r) => r.arrayBuffer()),
    fetch(`${FONT_BASE}/inter-latin-700-normal.woff`).then((r) => r.arrayBuffer()),
    fetch(`${FONT_BASE}/inter-latin-800-normal.woff`).then((r) => r.arrayBuffer()),
  ]);
  return [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Inter", data: black, weight: 800 as const, style: "normal" as const },
  ];
}

/**
 * Picks the words to punch out in magenta.
 *
 * The reference covers highlight the two or three words carrying the conflict.
 * Rather than asking the model for them (another field to keep in sync), pick
 * the longest non-trivial words: in a hook like "mi hermana me salió con que
 * quería ser la primera en caminar por el pasillo" those are the nouns and
 * verbs that actually carry the sentence.
 */
function pickHighlights(text: string): Set<string> {
  const STOP = new Set([
    "para", "porque", "cuando", "donde", "sobre", "entre", "hasta", "desde",
    "pero", "aunque", "mientras", "todos", "todas", "nunca", "siempre",
    "estaba", "estaban", "había", "habían", "tenía", "tenían", "aquella",
    "aquello", "entonces", "después", "antes", "entre",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length >= 6 && !STOP.has(w));

  const unique = Array.from(new Set(words));
  unique.sort((a, b) => b.length - a.length);
  return new Set(unique.slice(0, 3));
}

const normalise = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Admin-only, like every other route here. The dashboard fetches this with
  // its bearer token and renders the result from a blob URL, the same way the
  // voice previews work — an <img src> could not send the header.
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const { id } = await params;

  const format = (req.nextUrl.searchParams.get("format") ?? "tiktok") as FormatKey;
  const spec = FORMATS[format] ?? FORMATS.tiktok;

  const { data } = await admin
    .from("video_stories")
    .select("hook, youtube_title, internal_title")
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const story = data as {
    hook: string | null;
    youtube_title: string | null;
    internal_title: string;
  };

  // The hook is written to be the first line spoken, which is exactly what the
  // cover should say. Fall back to the title if a story predates it.
  const raw = (
    req.nextUrl.searchParams.get("text") ||
    story.hook ||
    story.youtube_title ||
    story.internal_title
  ).trim();

  // Long hooks stop being readable at a glance; the cover only needs the part
  // that creates the question.
  const text = raw.length > 190 ? `${raw.slice(0, 187).trimEnd()}…` : raw;
  const highlights = pickHighlights(text);

  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: spec.width,
          height: spec.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#FFFFFF",
          padding: format === "tiktok" ? "0 78px" : "0 72px",
          fontFamily: "Inter",
        }}
      >
        {/* Peekr Stories lockup */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: format === "tiktok" ? 54 : 34,
          }}
        >
          <div
            style={{
              width: spec.brand + 16,
              height: spec.brand + 16,
              borderRadius: 999,
              background: MAGENTA,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: spec.brand,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            P
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: spec.brand, fontWeight: 800, color: MAGENTA }}>Peekr</span>
            <span style={{ fontSize: spec.brand, fontWeight: 800, color: INK }}>Stories</span>
          </div>
        </div>

        {/* Hero text — the hook, with the load-bearing words in magenta */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: spec.hero,
            fontWeight: 800,
            color: INK,
            lineHeight: 1.18,
            letterSpacing: "-0.02em",
          }}
        >
          {text.split(/\s+/).map((word, i) => (
            <span
              key={i}
              style={{
                marginRight: 14,
                color: highlights.has(normalise(word)) ? MAGENTA : INK,
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* Engagement strip, the visual cue that says "this is a story post" */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 26,
            marginTop: format === "tiktok" ? 56 : 34,
            color: "#8A8A93",
            fontSize: spec.brand - 4,
            fontWeight: 700,
          }}
        >
          <span>♥ 99+</span>
          <span>💬 99+</span>
        </div>
      </div>
    ),
    { width: spec.width, height: spec.height, fonts }
  );
}
