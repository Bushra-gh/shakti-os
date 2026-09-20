"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Gauge,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  apiUrl,
  getTimeline,
  requestIncidentAction,
  updateIncidentStatus,
  websocketUrl,
  type Incident,
  type TimelineEntry,
} from "@/lib/api";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";

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

export default function IncidentDetail({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [incidentId, setIncidentId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timelineError, setTimelineError] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [actionState, setActionState] = useState("idle");
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState("notify_operator");
  const [connection, setConnection] = useState<ConnectionState>("CONNECTING");

  useEffect(() => {
    let stop: (() => void) | undefined;
    params.then(({ incidentId: id }) => {
      setIncidentId(id);
      stop = subscribeWithReconnect(
        websocketUrl("/ws/incidents"),
        (data) => {
          const update = JSON.parse(data) as { type: string; incident: Incident };
          if (update.type === "incident.updated" && update.incident.id === id) setIncident(update.incident);
        },
        setConnection,
      );
      fetch(`${apiUrl}/incidents/${id}`)
        .then((response) => {
          if (!response.ok) throw new Error();
          return response.json() as Promise<Incident>;
        })
        .then(setIncident)
        .catch(() => setError(true))
        .finally(() => setLoading(false));
      getTimeline(id).then(setTimeline).catch(() => setTimelineError(true));
    });
    return () => stop?.();
  }, [params]);

  const changeStatus = async (status: string) => {
    if (!incidentId) return;
    setStatusError(false);
    try {
      setIncident(await updateIncidentStatus(incidentId, status, note || undefined));
      setNote("");
      setTimeline(await getTimeline(incidentId));
    } catch {
      setStatusError(true);
    }
  };

  const requestAction = async () => {
    if (!incidentId) return;
    setActionState("sending");
    try {
      await requestIncidentAction(incidentId, actionType, note || undefined);
      setActionState("accepted");
      setTimeline(await getTimeline(incidentId));
    } catch {
      setActionState("error");
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#f5f5f7] px-4 py-8 text-[#1d1d1f] sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0071e3]"
          href="/dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to command center
        </Link>
        {loading && <p className="mt-16 text-[#6e6e73]">Loading incident...</p>}
        {error && <p className="mt-16 text-[#d70015]">Incident not found or API unavailable.</p>}
        {incident && (
          <>
            <header className="mt-10 mb-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[12px] font-medium tracking-[0.16em] text-[#6e6e73] uppercase">Incident assessment</p>
                <h1 className="mt-3 text-5xl font-medium capitalize tracking-[-0.06em] sm:text-7xl">{label(incident.type)}</h1>
                <p className="mt-3 text-sm font-medium text-[#6e6e73]">{incident.location}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={severityVariant[incident.severity] ?? "outline"}>{incident.severity}</Badge>
                <Badge variant={statusVariant[incident.status] ?? "outline"}>{incident.status}</Badge>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6e6e73]" />}>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        connection === "LIVE"
                          ? "bg-[#34c759]"
                          : connection === "CONNECTING" || connection === "RECONNECTING"
                            ? "bg-[#ff9f0a]"
                            : "bg-[#d70015]"
                      }`}
                    />
                    {connection}
                  </TooltipTrigger>
                  <TooltipContent>WebSocket status: {connection}</TooltipContent>
                </Tooltip>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-3">
              <Card className="group rounded-[1.75rem] bg-white py-0 ring-0 transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,.04)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium text-[#6e6e73]">Risk</p>
                    <Gauge className="h-4 w-4 text-[#6e6e73]" />
                  </div>
                  <p className="mt-4 text-4xl font-medium tracking-[-0.05em]">{Math.round(incident.risk * 100)}%</p>
                </CardContent>
              </Card>
              <Card className="group rounded-[1.75rem] bg-white py-0 ring-0 transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,.04)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium text-[#6e6e73]">Severity</p>
                    <ShieldAlert className="h-4 w-4 text-[#6e6e73]" />
                  </div>
                  <p className="mt-4 text-4xl font-medium tracking-[-0.05em]">{incident.severity}</p>
                </CardContent>
              </Card>
              <Card className="group rounded-[1.75rem] bg-white py-0 ring-0 transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,.04)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium text-[#6e6e73]">Confidence</p>
                    <ShieldCheck className="h-4 w-4 text-[#6e6e73]" />
                  </div>
                  <p className="mt-4 text-4xl font-medium tracking-[-0.05em]">{Math.round(incident.confidence * 100)}%</p>
                </CardContent>
              </Card>
            </section>

            {incident.status !== "RESOLVED" && (
              <Card className="mt-4 rounded-[1.75rem] bg-white py-0 ring-0">
                <CardHeader className="px-6 pt-6 pb-0"><CardTitle className="text-lg font-medium">Operator decision</CardTitle></CardHeader>
                <CardContent className="p-6">
                  <p className="text-sm text-[#6e6e73]">Review evidence, then approve the next incident state.</p>
                  <Textarea className="mt-4 min-h-24 rounded-2xl bg-[#f5f5f7]" placeholder="Optional operator note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {incident.status === "DETECTED" && <Button className="rounded-full font-medium" onClick={() => changeStatus("ASSESSING")}>Begin assessment</Button>}
                    {incident.status === "ASSESSING" && (
                      <>
                        <Button className="rounded-full font-medium" onClick={() => changeStatus("RESPONDING")}>Approve response</Button>
                        <Button variant="outline" className="rounded-full font-medium" onClick={() => changeStatus("RESOLVED")}>Resolve incident</Button>
                      </>
                    )}
                    {incident.status === "RESPONDING" && <Button className="rounded-full font-medium" onClick={() => changeStatus("RESOLVED")}>Resolve incident</Button>}
                  </div>
                  {statusError && <p className="mt-3 text-sm text-[#d70015]">Status update failed. Try again.</p>}
                </CardContent>
              </Card>
            )}

            {incident.status === "RESPONDING" && (
              <Card className="mt-4 rounded-[1.75rem] bg-white py-0 ring-0">
                <CardHeader className="px-6 pt-6 pb-0"><CardTitle className="text-lg font-medium">Approved response handoff</CardTitle></CardHeader>
                <CardContent className="p-6">
                  <p className="text-sm text-[#6e6e73]">Send a human-approved request to the configured n8n workflow.</p>
                  <Input className="mt-4 max-w-xs rounded-2xl bg-[#f5f5f7]" value={actionType} onChange={(event) => setActionType(event.target.value)} />
                  <Button className="mt-4 rounded-full font-medium" disabled={actionState === "sending"} onClick={requestAction}>{actionState === "sending" ? "Sending..." : "Request workflow"}</Button>
                  {actionState === "accepted" && <p className="mt-3 text-sm text-[#34c759]">Workflow request accepted.</p>}
                  {actionState === "error" && <p className="mt-3 text-sm text-[#d70015]">Workflow request failed.</p>}
                </CardContent>
              </Card>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="rounded-[1.75rem] bg-white py-0 ring-0">
                <CardHeader className="px-6 pt-6 pb-0"><CardTitle className="text-lg font-medium">Explainable factors</CardTitle></CardHeader>
                <CardContent className="p-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Factor</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(incident.factors).map(([factor, value]) => (
                        <TableRow key={factor}>
                          <TableCell className="capitalize">{label(factor)}</TableCell>
                          <TableCell className="text-right font-medium">{typeof value === "number" ? value.toFixed(2) : value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="pt-4 text-[12px] text-[#6e6e73]">Detected {new Date(incident.created_at).toLocaleString()} · Updated {new Date(incident.updated_at).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="rounded-[1.75rem] bg-white py-0 ring-0">
                <CardHeader className="px-6 pt-6 pb-0">
                  <CardTitle className="flex items-center gap-2 text-lg font-medium">
                    <Clock className="h-4 w-4" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {timelineError && <p className="text-sm text-[#d70015]">Timeline unavailable.</p>}
                  {!timelineError && !timeline.length && <p className="text-sm text-[#6e6e73]">No timeline entries recorded yet.</p>}
                  <ScrollArea className="h-72">
                    <div className="space-y-5 pr-4">
                      {timeline.map((entry) => (
                        <div key={entry.id}>
                          <p className="text-sm font-medium">{entry.type.replaceAll(".", " / ")}</p>
                          <p className="mt-1 text-[12px] text-[#6e6e73]">{new Date(entry.timestamp).toLocaleString()}</p>
                          <p className="mt-1 text-sm text-[#6e6e73]">{String(entry.details.event_type ?? entry.details.action_type ?? "event")} from {String(entry.details.source ?? entry.details.delivery ?? "operator")}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Separator className="my-8" />

            <footer className="pb-8 text-center text-[12px] text-[#6e6e73]">
              ShaktiOS · Incident Intelligence Platform
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
