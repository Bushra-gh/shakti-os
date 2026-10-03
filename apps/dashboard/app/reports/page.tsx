"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OperatorShell } from "@/components/dashboard/shell";
import { SourceBadge } from "@/components/dashboard/badges";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { formatFullDateTime, label } from "@/lib/format";

export default function ReportsPage() {
  const { events, loading, error, refresh } = useShaktiData();
  const [source, setSource] = useState("all");

  const evidence = useMemo(() => events.filter((e) => e.type === "citizen_report"), [events]);

  const sources = useMemo(() => Array.from(new Set(evidence.map((e) => e.source))).sort(), [evidence]);

  const filtered = useMemo(
    () => (source === "all" ? evidence : evidence.filter((e) => e.source === source)),
    [evidence, source],
  );

  const exportCsv = () => {
    const rows = [["timestamp", "source", "location", "confidence", "linked_incident", "payload"]];
    for (const e of filtered) {
      rows.push([
        e.timestamp,
        e.source,
        e.location,
        String(e.confidence),
        e.incident_id ?? "",
        JSON.stringify(e.payload).replaceAll('"', '""'),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "shaktios-evidence.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <OperatorShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Reports / Evidence</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Operator review of evidence associated with incidents — not the citizen reporting UI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={source} onValueChange={(v) => v && setSource(v)}>
            <SelectTrigger className="h-10 w-44 rounded-full bg-card" aria-label="Filter by source">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>{label(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="rounded-full" onClick={refresh}>
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="size-3.5" aria-hidden />
            Export
          </Button>
        </div>
      </div>

      <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">Citizen evidence</CardTitle>
            <Badge variant="outline">{filtered.length}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Metadata that actually exists. No photo attachments are shown — the private
            citizen-evidence storage bucket is reserved, but no backend upload endpoint exists yet.
          </p>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          {loading && <TableSkeleton rows={6} />}
          {!loading && error && <ErrorState onRetry={refresh} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              title={evidence.length === 0 ? "No citizen evidence yet" : "No evidence matches this filter"}
              hint="Citizen reports submitted through the citizen app appear here with backend linkage."
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Timestamp</TableHead>
                    <TableHead scope="col">Source</TableHead>
                    <TableHead scope="col">Location</TableHead>
                    <TableHead scope="col">Linked incident</TableHead>
                    <TableHead scope="col">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const linked = e.incident_id;
                    const description =
                      typeof e.payload.description === "string"
                        ? e.payload.description
                        : typeof e.payload.text === "string"
                          ? e.payload.text
                          : typeof e.payload.summary === "string"
                            ? e.payload.summary
                            : Object.entries(e.payload)
                              .slice(0, 3)
                              .map(([k, v]) => `${label(k)}: ${String(v)}`)
                              .join(" · ") || "Citizen observation";
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {formatFullDateTime(e.timestamp)}
                        </TableCell>
                        <TableCell><SourceBadge source={e.source} /></TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {label(e.location)}
                        </TableCell>
                        <TableCell>
                          {linked ? (
                            <Link
                              href={`/incidents/${linked}`}
                              className="text-xs font-medium text-info hover:underline"
                            >
                              Open incident →
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">Correlating…</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-72 truncate text-sm" title={description}>
                          {description}
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
    </OperatorShell>
  );
}
