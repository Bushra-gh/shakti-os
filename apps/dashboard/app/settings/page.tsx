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
      fetch(`${apiUrl}/health`),
      getIntegrations().catch(() => null),
    ]).then(async ([me, health, nextIntegrations]) => {
      if (cancelled) return;
      setIdentity(me);
      setName((me as Me & { display_name?: string }).display_name ?? me.email?.split("@")[0] ?? "");
      setApiStatus(health.ok ? "online" : "offline");
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
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
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
    setError(null);
    const client = supabase();
    if (!client) {
      setError("Supabase Auth is not configured.");
      return;
    }
    const { error: updateError } = await client.auth.updateUser({ data: { display_name: name.trim() } });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const logout = async () => {
    await supabase()?.auth.signOut();
    router.replace("/login");
  };

  return (
    <OperatorShell>
      <div className="mb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your Supabase profile and inspect live system connections.</p>
      </div>

      <div className="grid max-w-4xl gap-4">
        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-lg font-medium">Operator profile</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Profile data is stored in the current Supabase Auth session.</p>
          </CardHeader>
          <CardContent className="p-6">
            {loading && <p className="text-sm text-muted-foreground">Loading profile…</p>}
            {!loading && <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
              <div className="space-y-2"><label htmlFor="settings-name" className="text-xs font-medium text-muted-foreground">Display name</label><Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-2xl bg-muted" /></div>
              <div className="space-y-2"><label htmlFor="settings-email" className="text-xs font-medium text-muted-foreground">Email</label><Input id="settings-email" type="email" value={identity?.email ?? ""} readOnly disabled className="h-11 rounded-2xl bg-muted" /></div>
              <div className="space-y-2"><label htmlFor="settings-role" className="text-xs font-medium text-muted-foreground">Role</label><Input id="settings-role" value={identity?.role ?? ""} readOnly disabled className="h-11 rounded-2xl bg-muted" /></div>
              <div className="sm:col-span-2"><div className="flex flex-wrap gap-2"><Button type="submit" className="rounded-full font-medium">Save profile</Button><Button type="button" variant="outline" className="rounded-full font-medium" onClick={logout}><LogOut className="size-4" aria-hidden />Log out</Button></div>{saved && <p className="mt-2 flex items-center gap-1.5 text-sm text-success" role="status"><CheckCircle2 className="size-4" aria-hidden />Profile saved in Supabase Auth.</p>}{error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}</div>
            </form>}
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0"><CardTitle className="text-lg font-medium">Timeline notifications</CardTitle></CardHeader>
          <CardContent className="p-6 text-sm leading-7 text-muted-foreground"><p>There are no separate notification preferences. Follow the authenticated realtime streams or open the audit timeline for recorded updates.</p><Link href="/timeline" className="mt-3 inline-flex font-medium text-info hover:underline">Open incident timeline →</Link></CardContent>
        </Card>

        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0"><CardTitle className="text-lg font-medium">System</CardTitle></CardHeader>
          <CardContent className="p-6"><dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["API status", apiStatus === "checking" ? "Checking…" : apiStatus],
              ["API base URL", apiUrl],
              ["Incident stream", incidentState.toLowerCase()],
              ["Event stream", eventState.toLowerCase()],
              ["n8n configured", integrations ? String(integrations.n8n.configured) : "Unavailable"],
              ["n8n authenticated", integrations ? String(integrations.n8n.authenticated) : "Unavailable"],
            ].map(([key, value]) => <div key={key} className="rounded-2xl bg-muted p-3.5"><dt className="text-xs text-muted-foreground">{key}</dt><dd className="mt-0.5 font-medium break-all">{value}</dd></div>)}
          </dl><Separator className="my-4" /><p className="text-xs leading-6 text-muted-foreground">HTTP and WebSocket status above reflects this authenticated browser session. No client-only demo status is shown.</p></CardContent>
        </Card>
      </div>
    </OperatorShell>
  );
}
