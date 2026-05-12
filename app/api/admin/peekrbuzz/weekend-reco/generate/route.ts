import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // hook + article + 6 slide renders

/**
 * POST /api/admin/peekrbuzz/weekend-reco/generate
 *
 * Triggers the Thursday weekend recommendations pipeline manually from the
 * admin dashboard. Useful for:
 *   - smoke-testing the cron path
 *   - generating an off-week reco when something interesting trends mid-week
 *
 * Body (optional): { closing_word?: string }
 *   When omitted, the edge function rotates the closing word by ISO week.
 *
 * Internally invokes the `weekly_reco_for_admin` edge function with the
 * service-role bearer. Mirrors the same call pg_cron makes Thursdays at
 * 15:00 UTC, so passing through the admin route is equivalent to a manual
 * cron tick from the editor's perspective.
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
  const body = (await req.json().catch(() => ({}))) as { closing_word?: string };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }

  // ── Invoke edge function ───────────────────────────────────────────────────
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/weekly_reco_for_admin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body.closing_word ? { closing_word: body.closing_word } : {}),
      signal: AbortSignal.timeout(170_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error ?? `edge fn HTTP ${res.status}` },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `invoke: ${msg}` }, { status: 500 });
  }
}
