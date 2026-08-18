/**
 * YouTube Data API v3 integration.
 *
 * The refresh token lives in video_story_youtube_connection, a table with RLS
 * enabled and no policies — only the service role can read it. Nothing in this
 * module is safe to import from a client component, and no function here
 * returns a token to the caller.
 *
 * Tokens are never logged: error paths surface the API's message, never the
 * request body or Authorization header.
 */

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";
const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/videos";
const THUMBNAIL_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set";

/**
 * youtube.upload is required to publish. youtube.readonly is what lets us show
 * the channel name in the pre-publish confirmation — without it we would be
 * asking the user to confirm a channel we can't name.
 */
export const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export class YouTubeError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "YouTubeError";
  }
}

export interface YouTubeConnection {
  channel_id: string | null;
  channel_title: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new YouTubeError(500, `${name} no está configurada`);
  return value;
}

export function redirectUri(): string {
  return (
    process.env.YOUTUBE_OAUTH_REDIRECT_URI ||
    "https://www.peekr.app/api/admin/video-stories/youtube/callback"
  );
}

// ── OAuth state (CSRF protection) ────────────────────────────────────────────
// Signed with CRON_SECRET, which is already a server-only value in this
// project. The state carries the admin's user id so the callback can record
// who connected the account.

function stateSecret(): string {
  return process.env.CRON_SECRET || requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const mac = crypto.createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

/** Returns the user id, or null if the state is forged or older than 15 min. */
export function verifyState(state: string): string | null {
  const [encoded, mac] = state.split(".");
  if (!encoded || !mac) return null;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = crypto.createHmac("sha256", stateSecret()).update(payload).digest("hex");
  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (macBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(macBuf, expectedBuf)) {
    return null;
  }

  const [userId, issuedAt] = payload.split(".");
  if (!userId || !issuedAt) return null;
  if (Date.now() - Number(issuedAt) > 15 * 60_000) return null;

  return userId;
}

export function buildAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("YOUTUBE_OAUTH_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    // offline + consent is what produces a refresh token. Without `consent`,
    // Google omits it on every authorisation after the first, and the
    // connection silently stops working an hour later.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: signState(userId),
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// ── Token exchange & refresh ─────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    // Google echoes an `error` / `error_description` pair. Surface only those
    // — the request body contains the client secret and the refresh token.
    const detail = (await res.json().catch(() => ({}))) as {
      error?: string;
      error_description?: string;
    };
    throw new YouTubeError(
      res.status,
      `OAuth ${res.status}: ${detail.error_description || detail.error || "token request failed"}`
    );
  }

  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  return postToken({
    code,
    client_id: requireEnv("YOUTUBE_OAUTH_CLIENT_ID"),
    client_secret: requireEnv("YOUTUBE_OAUTH_CLIENT_SECRET"),
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
}

export async function fetchChannel(
  accessToken: string
): Promise<{ id: string; title: string } | null> {
  const url = `${CHANNELS_ENDPOINT}?part=snippet&mine=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new YouTubeError(res.status, `No se pudo leer el canal (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    items?: Array<{ id: string; snippet?: { title?: string } }>;
  };
  const item = data.items?.[0];
  if (!item) return null;
  return { id: item.id, title: item.snippet?.title ?? item.id };
}

/**
 * Returns a valid access token, refreshing it if it expires within 5 minutes.
 * The refreshed token is written back so concurrent requests reuse it.
 */
export async function getAccessToken(admin: SupabaseClient): Promise<string> {
  const { data } = await admin
    .from("video_story_youtube_connection")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", 1)
    .maybeSingle();

  const connection = data as Pick<
    YouTubeConnection,
    "access_token" | "refresh_token" | "token_expires_at"
  > | null;

  if (!connection?.refresh_token) {
    throw new YouTubeError(400, "No hay ninguna cuenta de YouTube conectada");
  }

  const expiresAt = connection.token_expires_at ? Date.parse(connection.token_expires_at) : 0;
  if (connection.access_token && expiresAt - Date.now() > 5 * 60_000) {
    return connection.access_token;
  }

  const refreshed = await postToken({
    client_id: requireEnv("YOUTUBE_OAUTH_CLIENT_ID"),
    client_secret: requireEnv("YOUTUBE_OAUTH_CLIENT_SECRET"),
    refresh_token: connection.refresh_token,
    grant_type: "refresh_token",
  });

  await admin
    .from("video_story_youtube_connection")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      // Google only re-issues a refresh token occasionally; keep the old one
      // when it doesn't.
      ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
    })
    .eq("id", 1);

  return refreshed.access_token;
}

// ── Upload ───────────────────────────────────────────────────────────────────

export interface UploadParams {
  accessToken: string;
  /** Signed URL of the rendered MP4 in Supabase Storage. */
  videoUrl: string;
  title: string;
  description: string;
  privacyStatus: "private" | "unlisted" | "public";
  tags?: string[];
}

/**
 * Resumable upload: initiate with the metadata, then stream the file body
 * straight from Storage to YouTube without buffering it in memory.
 */
export async function uploadVideo(params: UploadParams): Promise<{ videoId: string }> {
  const source = await fetch(params.videoUrl);
  if (!source.ok || !source.body) {
    throw new YouTubeError(502, `No se pudo leer el video renderizado (HTTP ${source.status})`);
  }

  const contentLength = source.headers.get("content-length");

  const initRes = await fetch(`${UPLOAD_ENDPOINT}?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": "video/mp4",
      ...(contentLength ? { "X-Upload-Content-Length": contentLength } : {}),
    },
    body: JSON.stringify({
      snippet: {
        title: params.title.slice(0, 100),
        description: params.description.slice(0, 5000),
        tags: params.tags?.slice(0, 15),
        categoryId: "24", // Entertainment
      },
      status: {
        privacyStatus: params.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!initRes.ok) {
    const detail = await initRes.text().catch(() => "");
    throw new YouTubeError(initRes.status, `YouTube rechazó la subida: ${detail.slice(0, 300)}`);
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new YouTubeError(502, "YouTube no devolvió una URL de subida");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      ...(contentLength ? { "Content-Length": contentLength } : {}),
    },
    body: source.body,
    // Streaming a request body requires half-duplex mode in undici.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => "");
    throw new YouTubeError(uploadRes.status, `Falló la subida: ${detail.slice(0, 300)}`);
  }

  const result = (await uploadRes.json()) as { id?: string };
  if (!result.id) {
    throw new YouTubeError(502, "YouTube no devolvió el id del video");
  }

  return { videoId: result.id };
}

/** Optional — skipped silently by callers when no thumbnail was rendered. */
export async function setThumbnail(
  accessToken: string,
  videoId: string,
  imageUrl: string
): Promise<void> {
  const source = await fetch(imageUrl);
  if (!source.ok || !source.body) {
    throw new YouTubeError(502, "No se pudo leer la miniatura");
  }

  const res = await fetch(`${THUMBNAIL_ENDPOINT}?videoId=${encodeURIComponent(videoId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": source.headers.get("content-type") ?? "image/jpeg",
    },
    body: source.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new YouTubeError(res.status, `No se pudo subir la miniatura: ${detail.slice(0, 200)}`);
  }
}
