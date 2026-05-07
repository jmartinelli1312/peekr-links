import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/newsletter/send
 *
 * Protected endpoint — caller must be an authenticated admin.
 * Accepts { edition_id: number } in the body.
 * Forwards to the newsletter_sender edge function with CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Verify caller is an authenticated admin ────────────────────────────

    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 2. Parse and validate body ────────────────────────────────────────────

    const body = (await req.json()) as { edition_id?: number };

    if (!body.edition_id || typeof body.edition_id !== "number") {
      return NextResponse.json({ error: "edition_id (number) required" }, { status: 400 });
    }

    // ── 3. Forward to edge function with CRON_SECRET ──────────────────────────

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const cronSecret  = process.env.CRON_SECRET;

    if (!supabaseUrl || !cronSecret) {
      return NextResponse.json(
        { error: "Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL or CRON_SECRET missing" },
        { status: 500 }
      );
    }

    const edgeFnUrl = `${supabaseUrl}/functions/v1/newsletter_sender`;

    const edgeRes = await fetch(edgeFnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ action: "send", edition_id: body.edition_id }),
      // Allow up to 5 minutes for large send jobs
      signal: AbortSignal.timeout(300_000),
    });

    const edgeData = await edgeRes.json().catch(() => ({}));

    if (!edgeRes.ok) {
      return NextResponse.json(
        { error: (edgeData as any).error ?? "Edge function error", detail: edgeData },
        { status: edgeRes.status }
      );
    }

    return NextResponse.json(edgeData);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
