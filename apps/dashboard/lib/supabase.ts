import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** True when the operator login can use real Supabase Auth. */
export const supabaseConfigured = supabaseUrl.length > 0 && supabaseKey.length > 0;

let client: SupabaseClient | null = null;

/** Supabase Auth client, or null when keys are not configured (demo fallback applies). */
export function supabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  client ??= createClient(supabaseUrl, supabaseKey);
  return client;
}

const TOKEN_KEY = "shaktios-access-token";

/** Persist the operator session token attached to API calls. Best-effort. */
export function saveAccessToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Session token is best-effort; the dashboard works without it.
  }
}

/** Operator session token for the Authorization header, if signed in. */
export function accessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
