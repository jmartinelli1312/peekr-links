import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/peekrbuzz/weekend-reco/publish-sneakpeek
 *
 * Body: { draft_id: string }
 *
 * Publishes a weekend-reco carousel (peekrbuzz_ig_queue) as a Flutter SneakPeek
 * carousel under the @peekr_oficial account, wiring up the referenced titles.
 *
 * Flow:
 *   1. Load the draft (slide_urls, caption, reco_tmdb_ids). Requires ≥2 slides.
 *   2. Resolve @peekr_oficial's creator id.
 *   3. Resolve the referenced titles' metadata from titles_cache.
 *   4. INSERT sneak_peeks (content_type='carousel', image_urls=slide_urls,
 *      is_published=true) + sneak_peek_title_refs rows.
 *   5. Stamp peekrbuzz_ig_queue.sneakpeek_id so this can't double-publish.
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ── Body ───────────────────────────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as { draft_id?: unknown };
  const draftId = typeof body.draft_id === "string" ? body.draft_id : null;
  if (!draftId) {
    return NextResponse.json({ error: "draft_id (string) required" }, { status: 400 });
  }

  // ── Load draft ───────────────────────────────────────────────────────────
  const { data: draft, error: loadErr } = await admin
    .from("peekrbuzz_ig_queue")
    .select("id, slide_urls, caption, hook_text, reco_tmdb_ids, sneakpeek_id")
    .eq("id", draftId)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: `lookup: ${loadErr.message}` }, { status: 500 });
  if (!draft) return NextResponse.json({ error: `draft ${draftId} not found` }, { status: 404 });

  if (draft.sneakpeek_id) {
    return NextResponse.json({ ok: true, already: true, sneakpeek_id: draft.sneakpeek_id });
  }

  const slideUrls = (draft.slide_urls as string[] | null) ?? [];
  if (slideUrls.length < 2) {
    return NextResponse.json(
      { error: `draft has ${slideUrls.length} slides; need ≥ 2` },
      { status: 400 },
    );
  }

  // ── Resolve @peekr_oficial ─────────────────────────────────────────────────
  const { data: official } = await admin
    .from("profiles")
    .select("id")
    .eq("username", "peekr_oficial")
    .maybeSingle();
  if (!official?.id) {
    return NextResponse.json({ error: "@peekr_oficial account not found" }, { status: 500 });
  }

  // ── Resolve referenced titles from titles_cache ────────────────────────────
  const ids = Array.isArray(draft.reco_tmdb_ids) ? (draft.reco_tmdb_ids as number[]) : [];
  let refs: {
    tmdb_id: number;
    media_type: string;
    title: string | null;
    poster_path: string | null;
  }[] = [];
  if (ids.length > 0) {
    const { data: cached } = await admin
      .from("titles_cache")
      .select("tmdb_id, media_type, title_es, title_en, title_pt, poster_path, poster_es")
      .in("tmdb_id", ids);
    const byId = new Map<number, (typeof refs)[number]>();
    for (const r of (cached ?? []) as Array<Record<string, unknown>>) {
      const tid = r.tmdb_id as number;
      // Keep insertion order stable to the reco list; first cache row per id wins.
      if (byId.has(tid)) continue;
      byId.set(tid, {
        tmdb_id: tid,
        media_type: (r.media_type as string) ?? "movie",
        title: (r.title_es as string) ?? (r.title_en as string) ?? (r.title_pt as string) ?? null,
        poster_path: (r.poster_es as string) ?? (r.poster_path as string) ?? null,
      });
    }
    // Preserve the reco ordering.
    refs = ids.map((id) => byId.get(id)).filter(Boolean) as typeof refs;
  }

  // ── Create the SneakPeek ───────────────────────────────────────────────────
  const caption = (draft.caption as string | null) ?? (draft.hook_text as string | null) ?? null;
  const { data: sp, error: spErr } = await admin
    .from("sneak_peeks")
    .insert({
      creator_id: official.id,
      content_type: "carousel",
      image_urls: slideUrls,
      thumbnail_url: slideUrls[0],
      caption,
      is_published: true,
    })
    .select("id")
    .single();
  if (spErr || !sp) {
    return NextResponse.json({ error: `sneak_peek insert: ${spErr?.message ?? "no row"}` }, { status: 500 });
  }
  const sneakPeekId = sp.id as string;

  // ── Attach referenced titles ───────────────────────────────────────────────
  if (refs.length > 0) {
    const rows = refs.map((r) => ({
      sneak_peek_id: sneakPeekId,
      tmdb_id: r.tmdb_id,
      media_type: r.media_type,
      title: r.title,
      poster_path: r.poster_path,
      ref_type: "title",
    }));
    const { error: refErr } = await admin.from("sneak_peek_title_refs").insert(rows);
    if (refErr) {
      // Non-fatal: the carousel is live; just log the ref failure.
      console.error("[publish-sneakpeek] title_refs insert failed:", refErr.message);
    }
  }

  // ── Stamp the draft so it can't double-publish ─────────────────────────────
  await admin
    .from("peekrbuzz_ig_queue")
    .update({ sneakpeek_id: sneakPeekId })
    .eq("id", draftId);

  return NextResponse.json({
    ok: true,
    sneakpeek_id: sneakPeekId,
    titles_linked: refs.length,
  });
}
