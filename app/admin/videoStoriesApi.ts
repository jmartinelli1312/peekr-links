"use client";

import { supabase } from "@/lib/supabase";

/**
 * Thin client for /api/admin/video-stories/*.
 *
 * Every write goes through the API rather than PostgREST: the tables grant
 * admins SELECT only, so the service role behind these routes is what performs
 * the mutation. That also keeps generation, TTS, and YouTube credentials on
 * the server.
 */

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
  return { Authorization: `Bearer ${token}` };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: await authHeader() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(body.message || body.error || `Error ${res.status}`, res.status, body.error);
  }
  return (await res.json()) as T;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH",
  body?: unknown
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(
      payload.message || payload.error || `Error ${res.status}`,
      res.status,
      payload.error
    );
  }
  return (await res.json()) as T;
}

/** GET variant of the above, for images the browser can't request directly. */
export async function apiBlobGet(path: string): Promise<string> {
  const res = await fetch(path, { headers: await authHeader() });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(payload.error || `Error ${res.status}`, res.status);
  }
  return URL.createObjectURL(await res.blob());
}

/** Fetches a binary response (voice samples) as an object URL. */
export async function apiBlobUrl(path: string, body: unknown): Promise<string> {
  const res = await fetch(path, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(payload.error || `Error ${res.status}`, res.status);
  }
  return URL.createObjectURL(await res.blob());
}
