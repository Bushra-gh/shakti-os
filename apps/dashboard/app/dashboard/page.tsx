"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Command,
  MapPinned,
  Radio,
  Send,
  Signal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  apiUrl,
  getEvents,
  getIncidents,
  submitEvent,
  type Event,
  type Incident,
  websocketUrl,
} from "@/lib/api";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";

const SituationMap = dynamic(() => import("@/components/situation-map"), { ssr: false });

const label = (value: string) => value.replaceAll("_", " ");

const severityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CRITICAL: "destructive",
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DETECTED: "outline",
  ASSESSING: "secondary",
  RESPONDING: "default",
  RESOLVED: "secondary",
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [incidentState, setIncidentState] = useState<ConnectionState>("CONNECTING");
  const [eventState, setEventState] = useState<ConnectionState>("CONNECTING");
  const [eventType, setEventType] = useState("crowd_density");
  const [location, setLocation] = useState("gate_4");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    Promise.all([fetch(`${apiUrl}/health`), getIncidents(), getEvents()])
      .then(async ([health, nextIncidents, nextEvents]) => {
        if (!health.ok) throw new Error("Health check failed");
        setIncidents(nextIncidents);
        setEvents(nextEvents);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    const stopIncidents = subscribeWithReconnect(
      websocketUrl("/ws/incidents"),
      (data) => {
        const update = JSON.parse(data) as { type: string; incident: Incident };
        if (update.type === "incident.updated") {
          setIncidents((current) =>
            [...current.filter((item) => item.id !== update.incident.id), update.incident]
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .slice(0, 50),
          );
        }
      },
      setIncidentState,
    );
    const stopEvents = subscribeWithReconnect(
      websocketUrl("/ws/events"),
      (data) => {
        const update = JSON.parse(data) as { type: string; event: Event };
        if (update.type === "event.created") setEvents((current) => [update.event, ...current].slice(0, 50));
      },
      setEventState,
    );
    return () => {
      stopIncidents();
      stopEvents();
    };
  }, []);

  const submit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setSending(true);
    setSent(false);
    try {
      const created = await submitEvent({
        type: eventType,
        source: "dashboard_demo",
        location,
        confidence: 0.9,
        payload: eventType === "crowd_density" ? { density: 0.72 } : { score: 0.72, velocity: 0.72 },
      });
      setEvents((current) => [created, ...current].slice(0, 50));
      setSent(true);
      setTimeout(() => setDialogOpen(false), 1200);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  const active = incidents.filter((item) => item.status !== "RESOLVED");
  const elevated = active.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity));
  const averageRisk = active.length ? active.reduce((sum, item) => sum + item.risk, 0) / active.length : 0;
  const connected = incidentState === "LIVE" && eventState === "LIVE";
  const plotted = useMemo(() => active.slice(0, 8), [active]);

  return (
    <main className="min-h-screen w-full bg-background px-4 py-6 text-foreground sm:px-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex size-10 items-center justify-center rounded-[1.1rem] bg-foreground text-background">
            <Command className="size-4" />
          </Link>
          <div>
            <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Command center</p>
            <h1 className="text-[28px] font-medium tracking-[-0.04em]">ShaktiOS</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="rounded-full font-medium" size="sm" />}>
              <Signal className="size-4" />New signal
            </DialogTrigger>
            <DialogContent className="rounded-[1.75rem] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-medium tracking-[-0.03em]">Submit a signal</DialogTitle>
              </DialogHeader>
              <form className="space-y-4 pt-2" onSubmit={submit}>
                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-muted-foreground">Signal type</label>
                  <Select value={eventType} onValueChange={(v) => v && setEventType(v)}>
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-muted font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crowd_density">Crowd density</SelectItem>
                      <SelectItem value="abnormal_movement">Abnormal movement</SelectItem>
                      <SelectItem value="social_concern">Social concern</SelectItem>
                      <SelectItem value="citizen_report">Citizen report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-muted-foreground">Location</label>
                  <Input className="h-11 rounded-2xl bg-muted font-medium" value={location} onChange={(event) => setLocation(event.target.value)} />
                </div>
                <Button className="h-11 w-full rounded-full font-medium" disabled={sending || !location.trim()} type="submit">
                  {sending ? "Sending..." : "Submit signal"}
                </Button>
                {sent && <p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" />Signal accepted.</p>}
              </form>
            </DialogContent>
          </Dialog>
          <Tooltip>
            <TooltipTrigger render={<div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-[12px] font-medium text-muted-foreground shadow-sm" />}>
              <span className={`size-2 rounded-full ${connected ? "bg-success" : "bg-warning"}`} />
              {connected ? "Live" : incidentState.toLowerCase()}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="rounded-xl">Incidents: {incidentState.toLowerCase()} · Events: {eventState.toLowerCase()}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {error && (
        <Card className="mb-6 rounded-[1.75rem] bg-card ring-0">
          <CardContent className="px-6 py-4 text-sm font-medium text-destructive">API unavailable. Start the ShaktiOS API to connect live operations.</CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Active incidents", value: String(active.length).padStart(2, "0"), note: `${elevated.length} elevated`, icon: Activity },
          { title: "Elevated risk", value: String(elevated.length).padStart(2, "0"), note: `${Math.round(averageRisk * 100)}% average`, icon: MapPinned },
          { title: "Signals", value: String(events.length).padStart(2, "0"), note: "Latest 50 retained", icon: Radio },
          { title: "Fusion", value: connected ? "Live" : "Wait", note: "Incident + event streams", icon: Signal },
        ].map(({ title, value, note, icon: Icon }) => (
          <Card key={title} className="group rounded-[1.75rem] bg-card py-0 ring-0 transition-shadow hover:shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{title}</p>
                <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-info" />
              </div>
              <p className="mt-6 text-4xl font-medium tracking-[-0.06em]">{value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.9fr]">
        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-lg font-medium tracking-[-0.03em]">Situation map</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Named gates from live incidents</p>
          </CardHeader>
          <CardContent className="p-0">
            {plotted.length > 0 ? (
              <SituationMap incidents={plotted} />
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-[1.4rem] bg-muted">
                <p className="text-sm text-muted-foreground">No active incidents to plot.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium tracking-[-0.03em]">Incident queue</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Newest correlated situations</p>
              </div>
              <Badge variant="outline">{active.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && <p className="px-6 py-8 text-sm text-muted-foreground">Loading operational data...</p>}
            {!loading && !active.length && (
              <div className="px-6 py-10 text-center">
                <CheckCircle2 className="mx-auto size-6 text-success" />
                <p className="mt-3 font-medium">No active incidents</p>
              </div>
            )}
            <ScrollArea className="max-h-[380px]">
              <div className="space-y-1 px-3 pb-3">
                {active.slice(0, 8).map((item) => (
                  <Link key={item.id} href={`/incidents/${item.id}`} className="flex items-center justify-between rounded-[1.25rem] px-4 py-4 transition-colors hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium capitalize">{label(item.type)}</p>
                      <p className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground"><MapPinned className="size-3 shrink-0" />{label(item.location)}</p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-3">
                      <Badge variant={severityVariant[item.severity] ?? "outline"}>{item.severity}</Badge>
                      <span className="w-10 text-right text-sm font-medium">{Math.round(item.risk * 100)}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-lg font-medium tracking-[-0.03em]">Activity feed</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Incidents and events in one view</p>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="incidents" className="px-6 pt-4">
              <TabsList className="mb-4 rounded-full bg-muted p-1">
                <TabsTrigger className="rounded-full px-4 font-medium" value="incidents">Incidents</TabsTrigger>
                <TabsTrigger className="rounded-full px-4 font-medium" value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="incidents">
                {loading ? (
                  <p className="py-8 text-sm text-muted-foreground">Loading...</p>
                ) : incidents.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No incidents yet.</p>
                ) : (
                  <ScrollArea className="max-h-[340px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Type</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Risk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidents.slice(0, 10).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell><Link href={`/incidents/${item.id}`} className="font-medium capitalize hover:text-info">{label(item.type)}</Link></TableCell>
                            <TableCell className="capitalize text-muted-foreground">{label(item.location)}</TableCell>
                            <TableCell><Badge variant={statusVariant[item.status] ?? "outline"}>{item.status}</Badge></TableCell>
                            <TableCell className="text-right font-medium">{Math.round(item.risk * 100)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>
              <TabsContent value="events">
                {loading ? (
                  <p className="py-8 text-sm text-muted-foreground">Loading...</p>
                ) : events.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No signals have arrived yet.</p>
                ) : (
                  <ScrollArea className="max-h-[340px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Type</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.slice(0, 10).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium capitalize">{label(item.type)}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{label(item.location)}</TableCell>
                            <TableCell className="text-muted-foreground">{item.source}</TableCell>
                            <TableCell className="text-right text-[12px] text-muted-foreground">{formatDateTime(item.timestamp)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-8 bg-border" />

      <footer className="flex items-center justify-between pb-4 text-[12px] font-medium text-muted-foreground">
        <span>Human-approved response</span>
        <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">Overview <ArrowUpRight className="size-3" /></Link>
      </footer>
    </main>
  );
}
