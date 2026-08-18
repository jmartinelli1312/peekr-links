import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { exchangeCode, fetchChannel, verifyState } from "@/lib/video-stories/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/video-stories/youtube/callback
 *
 * Google redirects the browser here, so there is no Bearer token to check —
 * the signed `state` is what proves an admin started the flow. It carries the
 * user id and expires after 15 minutes.
 *
 * Tokens go straight into video_story_youtube_connection (service role only)
 * and are never written to a log line or a redirect parameter.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const dashboard = new URL("/admin", req.nextUrl.origin);

  const fail = (reason: string) => {
    dashboard.searchParams.set("youtube", "error");
    dashboard.searchParams.set("reason", reason);
    return NextResponse.redirect(dashboard);
  };

  if (params.get("error")) return fail(params.get("error") ?? "denied");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("missing_code");

  const userId = verifyState(state);
  if (!userId) return fail("invalid_state");

  try {
    const tokens = await exchangeCode(code);

    // Without a refresh token the connection dies in an hour. Better to fail
    // loudly now than to have a publish break later.
    if (!tokens.refresh_token) {
      return fail("no_refresh_token");
    }

    const channel = await fetchChannel(tokens.access_token);

    const admin = getSupabaseAdmin();
    await admin.from("video_story_youtube_connection").upsert(
      {
        id: 1,
        channel_id: channel?.id ?? null,
        channel_title: channel?.title ?? null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope ?? null,
        connected_at: new Date().toISOString(),
        connected_by: userId,
      },
      { onConflict: "id" }
    );

    dashboard.searchParams.set("youtube", "connected");
    return NextResponse.redirect(dashboard);
  } catch {
    // Deliberately not echoing the exception: OAuth errors can carry request
    // detail we don't want in a URL or a browser history entry.
    return fail("exchange_failed");
  }
}
