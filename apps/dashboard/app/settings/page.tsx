"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { OperatorShell } from "@/components/dashboard/shell";
import { apiUrl, websocketUrl } from "@/lib/api";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";

export default function SettingsPage() {
  const [name, setName] = useState("Operator");
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState("system");
  const [saved, setSaved] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [incidentState, setIncidentState] = useState<ConnectionState>("CONNECTING");
  const [eventState, setEventState] = useState<ConnectionState>("CONNECTING");

  useEffect(() => {
    try {
      setName(localStorage.getItem("shaktios-operator-name") ?? "Operator");
      setEmail(localStorage.getItem("shaktios-operator-email") ?? "");
      setTheme(localStorage.getItem("shaktios-theme") ?? "system");
    } catch {
      // Defaults apply when storage is unavailable.
    }
    fetch(`${apiUrl}/health`)
      .then((r) => setApiStatus(r.ok ? "online" : "offline"))
      .catch(() => setApiStatus("offline"));
    const stopIncidents = subscribeWithReconnect(websocketUrl("/ws/incidents"), () => {}, setIncidentState);
    const stopEvents = subscribeWithReconnect(websocketUrl("/ws/events"), () => {}, setEventState);
    return () => {
      stopIncidents();
      stopEvents();
    };
  }, []);

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      localStorage.setItem("shaktios-operator-name", name.trim() || "Operator");
      localStorage.setItem("shaktios-operator-email", email.trim());
      localStorage.setItem("shaktios-theme", theme);
    } catch {
      // Best-effort session preferences.
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <OperatorShell>
      <div className="mb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, preferences, and system configuration.
        </p>
      </div>

      <div className="grid max-w-4xl gap-4">
        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-lg font-medium">Operator profile</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Session identity only — no backend operator registry exists yet.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
              <div className="space-y-2">
                <label htmlFor="settings-name" className="text-xs font-medium text-muted-foreground">Name</label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-2xl bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="settings-email" className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-2xl bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="settings-role" className="text-xs font-medium text-muted-foreground">Role</label>
                <Input
                  id="settings-role"
                  value="Operator · On duty"
                  disabled
                  className="h-11 rounded-2xl bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="settings-theme" className="text-xs font-medium text-muted-foreground">Theme</label>
                <Select value={theme} onValueChange={(v) => v && setTheme(v)}>
                  <SelectTrigger id="settings-theme" className="h-11 w-full rounded-2xl bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="rounded-full font-medium">
                  Save changes
                </Button>
                {saved && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-success" role="status">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Preferences saved on this device.
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-lg font-medium">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-sm leading-7 text-muted-foreground">
            <p>
              Push and email notifications are not supported by the current backend — realtime
              incident and event streams in this dashboard are the notification surface. No
              notification settings are stored server-side.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-lg font-medium">System</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["API status", apiStatus === "checking" ? "Checking…" : apiStatus],
                ["API base URL", apiUrl],
                ["Incident stream", incidentState.toLowerCase()],
                ["Event stream", eventState.toLowerCase()],
                ["Realtime model", "In-process · single API process · no replay"],
                ["Build", "ShaktiOS dashboard · HackSpire 2026"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-muted p-3.5">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 font-medium break-all">{v}</dd>
                </div>
              ))}
            </dl>
            <Separator className="my-4" />
            <p className="text-xs leading-6 text-muted-foreground">
              Version and build metadata endpoints do not exist on the backend; values above are
              the live connection state observed by this client.
            </p>
          </CardContent>
        </Card>
      </div>
    </OperatorShell>
  );
}
