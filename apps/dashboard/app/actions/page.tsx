"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OperatorShell } from "@/components/dashboard/shell";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { useRecentTimelines } from "@/hooks/use-timelines";
import { formatFullDateTime, label } from "@/lib/format";

export default function ActionsPage() {
  const { incidents, loading, error: dataError, refresh } = useShaktiData();
  const { entries, loading: timelinesLoading, error: timelineError } = useRecentTimelines(incidents, 15);
  const error = dataError || timelineError;

  const actions = useMemo(
    () => entries.filter((e) => e.type === "action.requested"),
    [entries],
  );

  const incidentById = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);

  return (
    <OperatorShell>
      <div className="mb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Action / Workflow Approvals</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Human-approved action requests forwarded to the n8n workflow. Detection never triggers a
          response on its own — every entry below follows an explicit operator approval.
        </p>
      </div>

      <Card className="mb-4 rounded-xl border-warning/30 bg-warning/5 py-0">
        <CardContent className="flex items-start gap-3 p-5 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-warning-foreground" aria-hidden />
          <p className="leading-7">
            <span className="font-semibold">Human approval checkpoint.</span> Actions can only be
            requested for incidents in <span className="font-semibold">RESPONDING</span> status —
            which itself requires an operator-approved transition. The backend forwards the request
            to <span className="font-mono text-xs">N8N_WEBHOOK_URL</span>; it does not execute
            autonomous emergency action.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl bg-card py-0 ring-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">Requested actions</CardTitle>
            <Badge variant="outline">{actions.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          {(loading || timelinesLoading) && <TableSkeleton rows={6} />}
          {!loading && !timelinesLoading && error && <ErrorState onRetry={refresh} />}
          {!loading && !timelinesLoading && !error && actions.length === 0 && (
            <EmptyState
              title="No actions requested yet"
              hint="Approve an incident through DETECTED → ASSESSING → RESPONDING, then request a workflow from the incident detail view."
            />
          )}
          {!loading && !timelinesLoading && !error && actions.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Requested at</TableHead>
                    <TableHead scope="col">Incident</TableHead>
                    <TableHead scope="col">Action type</TableHead>
                    <TableHead scope="col">Delivery</TableHead>
                    <TableHead scope="col">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((entry) => {
                    const incident = incidentById.get(entry.incident_id);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {formatFullDateTime(entry.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/incidents/${entry.incident_id}`}
                            className="font-medium hover:text-info hover:underline"
                          >
                            {incident
                              ? `${label(incident.type)} · ${label(incident.location)}`
                              : entry.incident_id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {String(entry.details.action_type ?? "—")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {String(entry.details.delivery ?? "—")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                          {String(entry.details.note ?? "—")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        Approval history is derived from backend timeline entries across the 15 most recently
        updated incidents. A dedicated action registry endpoint would be the production path for
        full audit search.
      </p>
    </OperatorShell>
  );
}
