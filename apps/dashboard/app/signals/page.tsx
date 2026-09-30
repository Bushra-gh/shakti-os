"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OperatorShell } from "@/components/dashboard/shell";
import { EventTypeBadge, SourceBadge } from "@/components/dashboard/badges";
import { SignalDialog } from "@/components/dashboard/signal-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { useRecentTimelines } from "@/hooks/use-timelines";
import { EVENT_TYPES, formatFullDateTime, label } from "@/lib/format";
import type { Event } from "@/lib/api";

function payloadSummary(payload: Record<string, unknown>) {
  const entries = Object.entries(payload).slice(0, 4);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${label(k)}: ${String(v)}`).join(" · ");
}

export default function SignalsPage() {
  const { incidents, events, loading, error, refresh, prependEvent } = useShaktiData();
  const { eventToIncident } = useRecentTimelines(incidents, 15);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [source, setSource] = useState("all");
  const [detail, setDetail] = useState<Event | null>(null);

  const sources = useMemo(() => Array.from(new Set(events.map((e) => e.source))).sort(), [events]);
  const locations = useMemo(() => Array.from(new Set(events.map((e) => e.location))).sort(), [events]);
  const [location, setLocation] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (source !== "all" && e.source !== source) return false;
      if (location !== "all" && e.location !== location) return false;
      if (q && !`${e.type} ${e.source} ${e.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, query, type, source, location]);

  return (
    <OperatorShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Signal / Event Explorer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and explore normalized events from all sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={refresh}>
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
          <SignalDialog onCreated={prependEvent} />
        </div>
      </div>

      <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events, locations…"
              aria-label="Search events"
              className="h-10 max-w-xs rounded-full bg-muted"
            />
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger className="h-10 w-44 rounded-full bg-muted" aria-label="Filter by event type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{label(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(v) => v && setSource(v)}>
              <SelectTrigger className="h-10 w-44 rounded-full bg-muted" aria-label="Filter by source">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>{label(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={location} onValueChange={(v) => v && setLocation(v)}>
              <SelectTrigger className="h-10 w-40 rounded-full bg-muted" aria-label="Filter by location">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l} value={l}>{label(l)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="ml-auto">{filtered.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          {loading && <TableSkeleton rows={8} />}
          {!loading && error && <ErrorState onRetry={refresh} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              title={events.length === 0 ? "No signals yet" : "No signals match these filters"}
              hint="Events from the crowd simulator, Civic-Shield bridge, and citizen app appear here."
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Time</TableHead>
                    <TableHead scope="col">Event type</TableHead>
                    <TableHead scope="col">Source</TableHead>
                    <TableHead scope="col">Location</TableHead>
                    <TableHead scope="col" className="text-right">Confidence</TableHead>
                    <TableHead scope="col">Incident</TableHead>
                    <TableHead scope="col">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatFullDateTime(item.timestamp)}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setDetail(item)}
                          className="hover:underline"
                          aria-label={`Open details for ${item.type} event`}
                        >
                          <EventTypeBadge type={item.type} />
                        </button>
                      </TableCell>
                      <TableCell><SourceBadge source={item.source} /></TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {label(item.location)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {Math.round(item.confidence * 100)}%
                      </TableCell>
                      <TableCell>
                        {eventToIncident[item.id] ? (
                          <Link
                            href={`/incidents/${eventToIncident[item.id]}`}
                            className="text-xs font-medium text-info hover:underline"
                          >
                            Open →
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground" title="Seen only in the latest retained events; correlation resolves as timelines load.">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                        {payloadSummary(item.payload)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="rounded-[1.75rem] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium capitalize">
              {detail ? label(detail.type) : "Signal detail"}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <ScrollArea className="max-h-[60vh]">
              <dl className="space-y-3 pr-2 text-sm">
                {[
                  ["Event ID", detail.id],
                  ["Timestamp", formatFullDateTime(detail.timestamp)],
                  ["Source", detail.source],
                  ["Location", label(detail.location)],
                  ["Confidence", `${Math.round(detail.confidence * 100)}%`],
                  ["Linked incident", eventToIncident[detail.id] ?? "Not yet correlated"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 text-right font-medium break-all">{v}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-muted-foreground">Payload</dt>
                  <dd>
                    <pre className="mt-1.5 overflow-x-auto rounded-2xl bg-muted p-3.5 text-xs leading-6">
                      {JSON.stringify(detail.payload, null, 2)}
                    </pre>
                  </dd>
                </div>
              </dl>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </OperatorShell>
  );
}
