"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OperatorShell } from "@/components/dashboard/shell";
import { SeverityBadge, StatusBadge } from "@/components/dashboard/badges";
import { SignalDialog } from "@/components/dashboard/signal-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { formatDateTime, label, riskPercent, SEVERITIES, STATUSES } from "@/lib/format";

type SortKey = "updated" | "risk" | "created";

export default function IncidentsPage() {
  const { incidents, loading, error, refresh, prependEvent } = useShaktiData();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [location, setLocation] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");

  const locations = useMemo(
    () => Array.from(new Set(incidents.map((i) => i.location))).sort(),
    [incidents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = incidents.filter((i) => {
      if (severity !== "all" && i.severity !== severity) return false;
      if (status !== "all" && i.status !== status) return false;
      if (location !== "all" && i.location !== location) return false;
      if (q && !`${i.type} ${i.location} ${i.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
    rows.sort((a, b) => {
      if (sortKey === "risk") return b.risk - a.risk;
      if (sortKey === "created") return b.created_at.localeCompare(a.created_at);
      return b.updated_at.localeCompare(a.updated_at);
    });
    return rows;
  }, [incidents, query, severity, status, location, sortKey]);

  return (
    <OperatorShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor and manage all incidents across sources.
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
              placeholder="Search incidents, locations…"
              aria-label="Search incidents"
              className="h-10 max-w-xs rounded-full bg-muted"
            />
            <Select value={severity} onValueChange={(v) => v && setSeverity(v)}>
              <SelectTrigger className="h-10 w-36 rounded-full bg-muted" aria-label="Filter by severity">
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger className="h-10 w-36 rounded-full bg-muted" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={location} onValueChange={(v) => v && setLocation(v)}>
              <SelectTrigger className="h-10 w-36 rounded-full bg-muted" aria-label="Filter by location">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l} value={l}>{label(l)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() =>
                setSortKey((k) => (k === "updated" ? "risk" : k === "risk" ? "created" : "updated"))
              }
              aria-label={`Sort by ${sortKey}. Activate to change sort.`}
            >
              <ArrowUpDown className="size-3.5" aria-hidden />
              {sortKey === "updated" ? "Updated" : sortKey === "risk" ? "Risk" : "Created"}
            </Button>
            <Badge variant="outline" className="ml-auto">{filtered.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          {loading && <TableSkeleton rows={8} />}
          {!loading && error && <ErrorState onRetry={refresh} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              title={incidents.length === 0 ? "No incidents yet" : "No incidents match these filters"}
              hint="New correlated events will create crowd_risk incidents here in realtime."
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Type</TableHead>
                    <TableHead scope="col">Location</TableHead>
                    <TableHead scope="col">Severity</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col" className="text-right">Risk</TableHead>
                    <TableHead scope="col" className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`/incidents/${item.id}`}
                          className="font-medium capitalize hover:text-info hover:underline"
                        >
                          {label(item.type)}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {label(item.location)}
                      </TableCell>
                      <TableCell><SeverityBadge value={item.severity} /></TableCell>
                      <TableCell><StatusBadge value={item.status} /></TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {riskPercent(item.risk)}%
                      </TableCell>
                      <TableCell className="text-right text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateTime(item.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </OperatorShell>
  );
}
