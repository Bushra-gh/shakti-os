"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { apiUrl, getEvents, getIncidents, submitEvent, websocketUrl, type Event, type Incident } from "@/lib/api";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";

const positions: Record<string, { left: string; top: string }> = { gate_1: { left: "18%", top: "28%" }, gate_2: { left: "72%", top: "24%" }, gate_3: { left: "78%", top: "72%" }, gate_4: { left: "26%", top: "70%" }, gate_9: { left: "50%", top: "48%" } };
const label = (value: string) => value.replaceAll("_", " ");
const severityClass = (value: string) => value === "HIGH" || value === "CRITICAL" ? "bg-[#a8442b] text-[#fff8ef]" : value === "MEDIUM" ? "bg-[#e7c17c]" : "bg-[#c9dfc9]";

export default function Home() {
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

  useEffect(() => {
    Promise.all([fetch(`${apiUrl}/health`), getIncidents(), getEvents()]).then(async ([health, nextIncidents, nextEvents]) => {
      if (!health.ok) throw new Error("Health check failed");
      setIncidents(nextIncidents); setEvents(nextEvents);
    }).catch(() => setError(true)).finally(() => setLoading(false));
    const stopIncidents = subscribeWithReconnect(websocketUrl("/ws/incidents"), (data) => {
      const update = JSON.parse(data) as { type: string; incident: Incident };
      if (update.type === "incident.updated") setIncidents((current) => [...current.filter((item) => item.id !== update.incident.id), update.incident].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 50));
    }, setIncidentState);
    const stopEvents = subscribeWithReconnect(websocketUrl("/ws/events"), (data) => {
      const update = JSON.parse(data) as { type: string; event: Event };
      if (update.type === "event.created") setEvents((current) => [update.event, ...current].slice(0, 50));
    }, setEventState);
    return () => { stopIncidents(); stopEvents(); };
  }, []);

  const submit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault(); setSending(true); setSent(false);
    try { const created = await submitEvent({ type: eventType, source: "dashboard_demo", location, confidence: 0.9, payload: eventType === "crowd_density" ? { density: 0.72 } : { score: 0.72, velocity: 0.72 } }); setEvents((current) => [created, ...current].slice(0, 50)); setSent(true); } catch { setError(true); } finally { setSending(false); }
  };

  const active = incidents.filter((item) => item.status !== "RESOLVED");
  const elevated = active.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity)).length;
  const plotted = useMemo(() => active.slice(0, 8), [active]);
  const connected = incidentState === "LIVE" && eventState === "LIVE";

  return <main className="mx-auto min-h-screen max-w-[1440px] bg-[var(--background)] px-5 py-8 text-[var(--foreground)] sm:px-12 sm:py-10">
    <header className="flex items-end justify-between gap-6"><div><p className="font-mono text-[.7rem] uppercase tracking-[.08em] text-[var(--accent-dark)]">Operational command center / 02</p><h1 className="mt-2 text-6xl font-extrabold leading-[.8] tracking-[-.06em] sm:text-8xl">SHAKTIOS</h1></div><div className="font-mono text-[.65rem] uppercase tracking-[.08em] text-[var(--muted)]"><span className={`mr-2 inline-block size-2 rounded-full ${connected ? "bg-[#3f8d59]" : "bg-[var(--accent-dark)]"}`} />INCIDENTS {incidentState} / EVENTS {eventState}</div></header>
    <div className="my-8 h-px bg-[var(--line)]" />
    <section className="grid gap-4 sm:grid-cols-3"><Card><CardHeader><CardTitle>Active incidents</CardTitle></CardHeader><CardContent className="text-4xl font-bold">{active.length.toString().padStart(2, "0")}</CardContent></Card><Card><CardHeader><CardTitle>Elevated risk</CardTitle></CardHeader><CardContent className={`text-4xl font-bold ${elevated ? "text-[var(--accent-dark)]" : ""}`}>{elevated.toString().padStart(2, "0")}</CardContent></Card><Card><CardHeader><CardTitle>Signals / latest 50</CardTitle></CardHeader><CardContent className="text-4xl font-bold">{events.length.toString().padStart(2, "0")}</CardContent></Card></section>
    {error && <p className="my-5 font-mono text-xs uppercase tracking-[.08em] text-[var(--accent-dark)]">API unavailable. Start the ShaktiOS API to connect the command center.</p>}
    <section className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Card className="min-h-[510px]"><CardHeader><CardTitle>Location overview</CardTitle><p className="mt-1 font-mono text-[.62rem] uppercase tracking-[.08em] text-[var(--muted)]">Live incident positions / named gates</p></CardHeader><CardContent><div className="relative min-h-[400px] overflow-hidden border border-[var(--line)] bg-[#e7eadf] before:absolute before:inset-0 before:bg-[linear-gradient(45deg,#bcc5b7_25%,transparent_25%),linear-gradient(-45deg,#bcc5b7_25%,transparent_25%)] before:bg-[length:32px_32px] before:opacity-35"><div className="absolute left-[-5%] right-[-5%] top-[47%] z-[1] h-11 -rotate-2 bg-[#f7f4e9] shadow-[0_0_0_1px_#d5d8cb]" /><div className="absolute bottom-[-5%] left-[49%] top-[-5%] z-[1] w-10 rotate-[18deg] bg-[#f7f4e9] shadow-[0_0_0_1px_#d5d8cb]" /><span className="absolute left-3 top-3 z-[2] font-mono text-[.62rem] tracking-[.1em] text-[#778274]">NORTH PLAZA</span><span className="absolute bottom-3 right-3 z-[2] font-mono text-[.62rem] tracking-[.1em] text-[#778274]">SOUTH ACCESS</span>{plotted.map((item) => <Link key={item.id} href={`/incidents/${item.id}`} className="absolute z-[3] flex -translate-x-1 -translate-y-1 items-center gap-2 font-mono text-[.65rem] uppercase" style={positions[item.location] ?? { left: "50%", top: "50%" }}><span className={`size-3 rounded-full border-2 border-[var(--panel)] ${severityClass(item.severity)}`} />{label(item.location)}</Link>)}{!plotted.length && <p className="absolute inset-x-0 top-1/2 text-center font-mono text-xs text-[var(--muted)]">No active incidents to plot.</p>}</div></CardContent></Card><Card className="min-h-[510px]"><CardHeader><CardTitle>Incident queue</CardTitle><p className="mt-1 font-mono text-[.62rem] uppercase tracking-[.08em] text-[var(--muted)]">Correlated situations / newest first</p></CardHeader><CardContent className="pt-0">{loading && <p className="font-mono text-xs text-[var(--muted)]">Loading operational data...</p>}{!loading && !incidents.length && <p className="font-mono text-xs text-[var(--muted)]">No incidents detected yet.</p>}{incidents.map((item) => <Link className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-4" href={`/incidents/${item.id}`} key={item.id}><div><strong className="block text-sm capitalize">{label(item.type)}</strong><span className="mt-1 block font-mono text-[.62rem] uppercase tracking-[.08em] text-[var(--muted)]">{label(item.location)} / {item.status}</span></div><div className="flex items-center gap-3"><Badge className={severityClass(item.severity)}>{item.severity}</Badge><strong className="font-mono text-xs">{Math.round(item.risk * 100)}%</strong></div></Link>)}</CardContent></Card></section>
    <section className="mt-4"><Card><CardHeader><CardTitle>Signal intake</CardTitle><p className="mt-1 font-mono text-[.62rem] uppercase tracking-[.08em] text-[var(--muted)]">Manual demo event / POST /events</p></CardHeader><CardContent><form className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={submit}><label className="font-mono text-[.68rem] uppercase text-[var(--muted)]">Signal type<select className="mt-2 block h-9 w-full border border-[var(--line)] bg-[var(--panel)] px-2 font-mono text-xs" value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="crowd_density">Crowd density</option><option value="abnormal_movement">Abnormal movement</option><option value="social_concern">Social concern</option><option value="citizen_report">Citizen report</option></select></label><label className="font-mono text-[.68rem] uppercase text-[var(--muted)]">Location<Input value={location} onChange={(event) => setLocation(event.target.value)} /></label><Button disabled={sending || !location.trim()}>{sending ? "Sending..." : "Submit signal"}</Button></form>{sent && <p className="mt-3 text-xs text-[#3f8d59]">Signal accepted. Incident correlation and realtime updates should follow.</p>}</CardContent></Card></section>
    <section className="mt-14"><div className="mb-4 flex items-end justify-between gap-6"><div><p className="font-mono text-[.7rem] uppercase tracking-[.08em] text-[var(--accent-dark)]">Evidence intake</p><h2 className="mt-2 text-4xl tracking-[-.05em]">Latest signals</h2></div><span className="font-mono text-xs text-[var(--muted)]">{events.length} retained</span></div><Separator /><div>{events.slice(0, 8).map((item) => <div className="grid items-center gap-4 border-b border-[var(--line)] py-3 font-mono text-xs uppercase sm:grid-cols-[150px_1fr_1fr_110px]" key={item.id}><Badge className="w-fit" variant="outline">{label(item.type)}</Badge><span>{label(item.location)}</span><span className="text-[var(--accent-dark)]">{item.source}</span><time className="sm:text-right">{new Date(item.timestamp).toLocaleTimeString()}</time></div>)}{!loading && !events.length && <p className="py-4 font-mono text-xs text-[var(--muted)]">No signals have arrived yet.</p>}</div></section>
  </main>;
}
