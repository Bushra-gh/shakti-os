"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { OperatorShell } from "@/components/dashboard/shell";
import { EventTypeBadge, SeverityBadge, SourceBadge, StatusBadge } from "@/components/dashboard/badges";
import { RiskFactors, RiskScore } from "@/components/dashboard/risk";
import { TimelineView } from "@/components/dashboard/timeline-view";
import { EmptyState } from "@/components/dashboard/states";
import {
  apiUrl,
  getTimeline,
  requestIncidentAction,
  updateIncidentStatus,
  websocketUrl,
  type Incident,
  type TimelineEntry,
} from "@/lib/api";
import { useShaktiData } from "@/hooks/use-shakti";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";
import { ALLOWED_TRANSITIONS, formatDateTime, formatFullDateTime, label, riskPercent } from "@/lib/format";

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState("notify_operator");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("CONNECTING");

  const { events } = useShaktiData();

  useEffect(() => {
    let stop: (() => void) | undefined;
    params.then(({ incidentId: id }) => {
      setIncidentId(id);
      stop = subscribeWithReconnect(
        websocketUrl("/ws/incidents"),
        (data) => {
          try {
            const update = JSON.parse(data) as { type: string; incident: Incident };
            if (update.type === "incident.updated" && update.incident.id === id) setIncident(update.incident);
          } catch {
            // Ignore malformed payloads; the next fetch recovers.
          }
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
    setActionError(null);
    try {
      await requestIncidentAction(incidentId, actionType, note || undefined);
      setActionState("accepted");
      setReviewOpen(false);
      setTimeline(await getTimeline(incidentId));
    } catch (err) {
      setActionState("error");
      setActionError(err instanceof Error ? err.message : "Workflow request failed.");
    }
  };

  const correlatedEvents = useMemo(
    () => timeline.filter((e) => e.type === "event.correlated"),
    [timeline],
  );

  const sameLocationEvents = useMemo(() => {
    if (!incident) return [];
    return events
      .filter((e) => e.location === incident.location)
      .slice(0, 8);
  }, [events, incident]);

  const allowed = incident
    ? (ALLOWED_TRANSITIONS[incident.status as keyof typeof ALLOWED_TRANSITIONS] ?? [])
    : [];

  return (
    <OperatorShell>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/incidents" className="inline-flex items-center gap-1 font-medium text-info hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden />
          Incidents
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate font-medium text-foreground">
          {incident ? `${label(incident.type)} · ${label(incident.location)}` : "Detail"}
        </span>
      </nav>

      {loading && <p className="mt-16 text-muted-foreground" role="status">Loading incident…</p>}
      {error && (
        <p className="mt-16 text-destructive" role="alert">
          Incident not found or API unavailable.
        </p>
      )}
      {incident && (
        <>
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Incident assessment</p>
              <h1 className="mt-2 text-4xl font-medium capitalize tracking-[-0.05em] sm:text-5xl">{label(incident.type)}</h1>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {label(incident.location)} · detected {formatDateTime(incident.created_at)} · updated {formatDateTime(incident.updated_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge value={incident.severity} />
              <StatusBadge value={incident.status} />
              <Badge variant="outline" className="tabular-nums">{riskPercent(incident.risk)}% risk</Badge>
              <span className="text-xs text-muted-foreground" title={`WebSocket status: ${connection}`}>
                <span
                  className={`mr-1.5 inline-block size-2 rounded-full ${
                    connection === "LIVE" ? "bg-success" : connection === "DISCONNECTED" ? "bg-destructive" : "bg-warning"
                  }`}
                  aria-hidden
                />
                {connection.toLowerCase()}
              </span>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]" aria-label="Risk summary">
            <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Risk summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <RiskScore risk={incident.risk} severity={incident.severity} confidence={incident.confidence} />
                <Separator />
                <div>
                  <p className="text-sm font-medium">Why this incident exists</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    <li>· {correlatedEvents.length} correlated {correlatedEvents.length === 1 ? "signal" : "signals"} at {label(incident.location)}</li>
                    <li>· {Object.keys(incident.factors).filter((k) => k !== "citizen_report_count").length} explainable risk factors tracked</li>
                    <li>· Confidence {Math.round(incident.confidence * 100)}% (strongest contributing signal)</li>
                    <li>· Status {incident.status} — operator-controlled lifecycle</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            <RiskFactors factors={incident.factors} />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Signals / evidence</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recent events at {label(incident.location)} — same-location context, newest first.
                </p>
              </CardHeader>
              <CardContent className="p-0 pt-2 pb-2">
                {sameLocationEvents.length === 0 ? (
                  <EmptyState title="No recent signals cached" hint="Open Signals / Events for the full backend event list." />
                ) : (
                  <ScrollArea className="max-h-72">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead scope="col">Type</TableHead>
                          <TableHead scope="col">Source</TableHead>
                          <TableHead scope="col" className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sameLocationEvents.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell><EventTypeBadge type={e.type} /></TableCell>
                            <TableCell><SourceBadge source={e.source} /></TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {formatFullDateTime(e.timestamp)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Timeline</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Chronological audit record</p>
              </CardHeader>
              <CardContent className="p-6">
                {timelineError && <p className="text-sm text-destructive" role="alert">Timeline unavailable.</p>}
                {!timelineError && (
                  <ScrollArea className="h-72">
                    <div className="pr-4">
                      <TimelineView entries={timeline} />
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </section>

          {incident.status !== "RESOLVED" && (
            <Card className="mt-4 rounded-[1.75rem] bg-card py-0 ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Operator decision</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Review evidence, then approve the next incident state. Only allowed transitions
                  are shown; the backend rejects anything else.
                </p>
                <Textarea
                  className="mt-4 min-h-24 rounded-2xl bg-muted"
                  placeholder="Optional operator note — stored with the next status change"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  aria-label="Operator note"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {allowed.length === 0 && (
                    <p className="text-sm text-muted-foreground">No further transitions available.</p>
                  )}
                  {allowed.map((status) => (
                    <Button
                      key={status}
                      className="rounded-full font-medium"
                      variant={status === "RESOLVED" ? "outline" : "default"}
                      onClick={() => changeStatus(status)}
                    >
                      {status === "ASSESSING" && "Begin assessment"}
                      {status === "RESPONDING" && "Approve response"}
                      {status === "RESOLVED" && "Resolve incident"}
                    </Button>
                  ))}
                </div>
                {statusError && (
                  <p className="mt-3 text-sm text-destructive" role="alert">
                    Status update failed. The transition may be invalid or the API unreachable.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {incident.status === "RESPONDING" && (
            <Card className="mt-4 rounded-[1.75rem] border-warning/30 bg-warning/5 py-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="flex items-center gap-2 text-lg font-medium">
                  <ShieldAlert className="size-5 text-warning-foreground" aria-hidden />
                  Proposed action — human approval required
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm leading-7 text-muted-foreground">
                  Analysis and action are separate. Approving below forwards one request to the
                  configured n8n workflow — it does not execute autonomous emergency action.
                </p>
                <div className="mt-4 flex max-w-md flex-col gap-3">
                  <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="action-type">
                    Requested action
                    <Input
                      id="action-type"
                      className="h-11 rounded-2xl bg-card"
                      value={actionType}
                      onChange={(event) => setActionType(event.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      className="rounded-full font-medium"
                      disabled={actionState === "sending" || !actionType.trim()}
                      onClick={() => setReviewOpen(true)}
                    >
                      Review & approve
                    </Button>
                  </div>
                  {actionState === "accepted" && (
                    <p className="text-sm font-medium text-success" role="status">Workflow request accepted and recorded in the timeline.</p>
                  )}
                  {actionState === "error" && (
                    <p className="text-sm font-medium text-destructive" role="alert">{actionError}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
            <DialogContent className="rounded-[1.75rem] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-medium">Approve action?</DialogTitle>
              </DialogHeader>
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Incident", `${label(incident.type)} · ${label(incident.location)}`],
                  ["Current risk", `${riskPercent(incident.risk)}% · ${incident.severity}`],
                  ["Requested action", actionType],
                  ["Evidence", `${correlatedEvents.length} correlated signals at ${label(incident.location)}`],
                  ["Operator note", note || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="rounded-2xl bg-muted p-3.5 text-xs leading-6 text-muted-foreground">
                This forwards a human-approved request to the n8n workflow. ShaktiOS never acts
                autonomously — the timeline records this approval for audit.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setReviewOpen(false)}>
                  Cancel
                </Button>
                <Button className="rounded-full" disabled={actionState === "sending"} onClick={requestAction}>
                  {actionState === "sending" ? "Submitting…" : "Approve action"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Separator className="my-8" />
          <footer className="pb-8 text-center text-xs text-muted-foreground">
            ShaktiOS · Every signal becomes traceable evidence.
          </footer>
        </>
      )}
    </OperatorShell>
  );
}
