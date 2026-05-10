import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/newsletter/test
 *
 * Sends the newsletter HTML to a single address for design review.
 * Does NOT mark the edition as sent or record newsletter_sends rows.
 *
 * Body: { edition_id: number, email: string, lang: "es" | "pt" }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as { email?: string; lang?: string };

    if (!body.email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const cronSecret  = process.env.CRON_SECRET;

    if (!supabaseUrl || !cronSecret) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/newsletter_sender`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        action: "test",
        email:  body.email,
        lang:   body.lang ?? "es",
      }),
      signal: AbortSignal.timeout(60_000),
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
