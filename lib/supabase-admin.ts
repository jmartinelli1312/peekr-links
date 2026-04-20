import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side writes (cron jobs, admin
 * API routes). Bypasses Row Level Security — never import this from a
 * client component or anything exposed to the browser.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var (Supabase dashboard →
 * Settings → API → service_role key).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — required for admin writes"
    );
  }

  if (!cached) {
    cached = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cached;
}
