import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** True when the dashboard can use the real Supabase Auth session. */
export const supabaseConfigured = supabaseUrl.length > 0 && supabaseKey.length > 0;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  client ??= createClient(supabaseUrl, supabaseKey);
  return client;
}

/**
 * Read the current access token from the live Supabase session.
 *
 * The API and WebSocket clients deliberately do not maintain a second token
 * cache. Supabase owns session persistence and refresh, so every request uses
 * the session that Auth currently considers valid.
 */
export async function accessToken(): Promise<string | null> {
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}
