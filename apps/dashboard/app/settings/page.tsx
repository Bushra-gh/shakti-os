"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { OperatorShell } from "@/components/dashboard/shell";
import { apiUrl, getIntegrations, getMe, websocketUrl, type Integrations, type Me } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";
import { accessToken } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [incidentState, setIncidentState] = useState<ConnectionState>("CONNECTING");
  const [eventState, setEventState] = useState<ConnectionState>("CONNECTING");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMe(),
      fetch(`${apiUrl}/health`).catch(() => null),
      getIntegrations().catch(() => null),
    ]).then(async ([me, health, nextIntegrations]) => {
      if (cancelled) return;
      setIdentity(me);
      setName((me as Me & { display_name?: string }).display_name ?? me.email?.split("@")[0] ?? "");
      setApiStatus(health?.ok ? "online" : "offline");
      setIntegrations(nextIntegrations);
      try {
        const client = supabase();
        const session = await client?.auth.getSession();
        if (!cancelled) {
          const displayName = session?.data.session?.user?.user_metadata?.display_name;
          if (typeof displayName === "string") setName(displayName);
        }
      } catch {
        // The API identity remains authoritative when user metadata is unavailable.
      }
      if (!cancelled) setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setApiStatus("offline");
        setError("Unable to load the operator profile.");
        setLoading(false);
      }
    });
    const stopIncidents = subscribeWithReconnect(websocketUrl("/ws/incidents"), accessToken, () => {}, setIncidentState);
    const stopEvents = subscribeWithReconnect(websocketUrl("/ws/events"), accessToken, () => {}, setEventState);
    return () => {
      cancelled = true;
      stopIncidents();
      stopEvents();
    };
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const client = supabase();
      if (!client) throw new Error("Supabase Auth is not configured.");
      const { error: updateError } = await client.auth.updateUser({ data: { display_name: name.trim() } });
      if (updateError) throw updateError;
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profile could not be saved. Retry when Auth is reachable.");
    } finally { setSaving(false); }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setError(null);
    try {
      const client = supabase();
      if (!client) throw new Error("Supabase Auth is not configured.");
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign out failed. Please retry.");
    } finally { setLoggingOut(false); }
  };

  return (
    <OperatorShell>
      <div className="mb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your Supabase profile and inspect live system connections.</p>
      </div>

      <div className="grid max-w-4xl gap-4">
        <Card className="rounded-xl bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-lg font-medium">Operator profile</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Profile data is stored in the current Supabase Auth session.</p>
          </CardHeader>
          <CardContent className="p-6">
            {loading && <p className="text-sm text-muted-foreground">Loading profile…</p>}
            {!loading && <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
              <div className="space-y-2"><label htmlFor="settings-name" className="text-xs font-medium text-muted-foreground">Display name</label><Input id="settings-name" value={name} maxLength={100} onChange={(e) => { setName(e.target.value); setSaved(false); }} className="h-11 rounded-lg bg-muted" /></div>
              <div className="space-y-2"><label htmlFor="settings-email" className="text-xs font-medium text-muted-foreground">Email</label><Input id="settings-email" type="email" value={identity?.email ?? ""} readOnly disabled className="h-11 rounded-lg bg-muted" /></div>
              <div className="space-y-2"><label htmlFor="settings-role" className="text-xs font-medium text-muted-foreground">Role</label><Input id="settings-role" value={identity?.role ?? ""} readOnly disabled className="h-11 rounded-lg bg-muted" /></div>
              <div className="sm:col-span-2"><div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving || !identity} className="rounded-lg font-medium">{saving ? "Saving…" : "Save profile"}</Button><Button type="button" variant="outline" className="rounded-lg font-medium" disabled={loggingOut || saving} onClick={logout}><LogOut className="size-4" aria-hidden />Log out</Button></div>{saved && <p className="mt-2 flex items-center gap-1.5 text-sm text-success" role="status"><CheckCircle2 className="size-4" aria-hidden />Profile saved in Supabase Auth.</p>}{error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}</div>
            </form>}
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0"><CardTitle className="text-lg font-medium">Timeline notifications</CardTitle></CardHeader>
          <CardContent className="p-6 text-sm leading-7 text-muted-foreground"><p>There are no separate notification preferences. Follow the authenticated realtime streams or open the audit timeline for recorded updates.</p><Link href="/timeline" className="mt-3 inline-flex font-medium text-info hover:underline">Open incident timeline →</Link></CardContent>
        </Card>

        <Card className="rounded-xl bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0"><CardTitle className="text-lg font-medium">System</CardTitle></CardHeader>
          <CardContent className="p-6"><dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["API status", apiStatus === "checking" ? "Checking…" : apiStatus],
              ["API base URL", apiUrl],
              ["Incident stream", incidentState.toLowerCase()],
              ["Event stream", eventState.toLowerCase()],
              ["n8n configured", integrations ? String(integrations.n8n.configured) : "Unavailable"],
              ["n8n secret configured", integrations ? String(integrations.n8n.authenticated) : "Unavailable"],
            ].map(([key, value]) => <div key={key} className="rounded-lg bg-muted p-3.5"><dt className="text-xs text-muted-foreground">{key}</dt><dd className="mt-0.5 font-medium break-all">{value}</dd></div>)}
          </dl><Separator className="my-4" /><p className="text-xs leading-6 text-muted-foreground">HTTP reachability and WebSocket status reflect this browser session. n8n flags indicate configuration presence only, not provider health, matching credentials or delivery.</p></CardContent>
        </Card>
      </div>
    </OperatorShell>
  );
}
