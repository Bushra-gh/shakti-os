/** Public build-time configuration only. Never place server credentials here. */
export function publicEndpoint(value: string | undefined, name: string, production: boolean) {
  if (!value?.trim()) return { url: "", error: `${name} is missing. Configure the dashboard build environment and rebuild.` };
  try {
    const url = new URL(value.trim());
    const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost") || /^(127\.|0\.|\[::1\]$)/.test(url.hostname);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      /your[_-]|placeholder|example\.(com|org|net)$|\.(invalid|example)$|<|>/i.test(url.hostname) ||
      (production && (url.protocol !== "https:" || local))) throw new Error("Invalid endpoint");
    return { url: url.toString().replace(/\/+$/, ""), error: null };
  } catch {
    return { url: "", error: `${name} must be an absolute ${production ? "public HTTPS" : "HTTP(S)"} URL without credentials, query, fragment or placeholders. Rebuild after correcting it.` };
  }
}

export function publicAuthKeyError(key: string): string | null {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  // Legacy anon JWTs are public. A service-role JWT or sb_secret key never is.
  try {
    const payload = key.split(".")[1];
    if (key.split(".").length === 3 && payload && JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))).role === "anon") return null;
  } catch { /* Invalid or placeholder public key. */ }
  return "Configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy anon key) and rebuild. Never use a secret/service-role key in a client build.";
}

const production = process.env.NODE_ENV === "production";
const api = publicEndpoint(process.env.NEXT_PUBLIC_API_URL ?? (production ? "" : "http://localhost:8000"), "NEXT_PUBLIC_API_URL", production);
const auth = publicEndpoint(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL", production);
export const apiUrl = api.url;
export const apiConfigurationError = api.error;
export const supabaseUrl = auth.url;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabaseConfigurationError = auth.error ?? publicAuthKeyError(supabaseKey);
