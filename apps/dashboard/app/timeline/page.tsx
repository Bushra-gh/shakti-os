"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OperatorShell } from "@/components/dashboard/shell";
import { TimelineView } from "@/components/dashboard/timeline-view";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/dashboard/states";
import { useShaktiData, useIncidentTimeline } from "@/hooks/use-shakti";
import { useRecentTimelines } from "@/hooks/use-timelines";
import { label } from "@/lib/format";

const ENTRY_TYPES = [
  "event.correlated",
  "status.changed",
  "action.requested",
  "risk.updated",
  "severity.updated",
  "operator.note",
];

export default function TimelinePage() {
  const { incidents, loading, error, refresh } = useShaktiData();
  const [incidentId, setIncidentId] = useState("all");
  const [entryType, setEntryType] = useState("all");

  const single = useIncidentTimeline(incidentId === "all" ? undefined : incidentId);
  const recent = useRecentTimelines(incidents, 15);

  const entries = useMemo(() => {
    const base = incidentId === "all" ? recent.entries : single.timeline;
    if (entryType === "all") return base;
    return base.filter((e) => e.type === entryType);
  }, [incidentId, recent.entries, single.timeline, entryType]);

  const busy = loading || (incidentId === "all" ? false : single.loading);

  return (
    <OperatorShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Incident Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full audit history of detection, assessment, and action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={incidentId} onValueChange={(v) => v && setIncidentId(v)}>
            <SelectTrigger className="h-10 w-56 rounded-full bg-card" aria-label="Filter by incident">
              <SelectValue placeholder="All incidents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All recent incidents</SelectItem>
              {incidents.slice(0, 30).map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {label(i.type)} · {label(i.location)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entryType} onValueChange={(v) => v && setEntryType(v)}>
            <SelectTrigger className="h-10 w-48 rounded-full bg-card" aria-label="Filter by entry type">
              <SelectValue placeholder="All entry types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entry types</SelectItem>
              {ENTRY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.replaceAll(".", " / ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="mx-auto max-w-3xl rounded-[1.75rem] bg-card py-0 ring-0">
        <CardHeader className="px-6 pt-6 pb-0">
          <CardTitle className="text-lg font-medium">
            {incidentId === "all" ? "Recent activity across incidents" : "Incident history"}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} · newest first
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {busy && <TableSkeleton rows={6} />}
          {!busy && (error || single.error) && <ErrorState onRetry={refresh} />}
          {!busy && !error && !single.error && entries.length === 0 && (
            <EmptyState
              title="No timeline entries"
              hint="Correlated events, status changes, operator notes, and approved actions are recorded here."
            />
          )}
          {!busy && !error && !single.error && entries.length > 0 && (
            <ScrollArea className="max-h-[70vh]">
              <div className="pr-4">
                <TimelineView entries={entries} showIncidentLink={incidentId === "all"} />
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </OperatorShell>
  );
}
