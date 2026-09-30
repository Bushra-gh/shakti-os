"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  MapPinned,
  Radio,
  Signal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperatorShell } from "@/components/dashboard/shell";
import { SeverityBadge, StatusBadge } from "@/components/dashboard/badges";
import { SignalDialog } from "@/components/dashboard/signal-dialog";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { formatDateTime, label, riskPercent } from "@/lib/format";

const SituationMap = dynamic(() => import("@/components/situation-map"), { ssr: false });

export default function DashboardPage() {
  const {
    incidents,
    events,
    loading,
    error,
    connected,
    refresh,
    prependEvent,
  } = useShaktiData();

  const active = useMemo(() => incidents.filter((item) => item.status !== "RESOLVED"), [incidents]);
  const elevated = useMemo(
    () => active.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity)),
    [active],
  );
  const averageRisk = active.length
    ? active.reduce((sum, item) => sum + item.risk, 0) / active.length
    : 0;
  const plotted = useMemo(() => active.slice(0, 8), [active]);

  return (
    <OperatorShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live incidents, signals, and system status.
          </p>
        </div>
        <SignalDialog onCreated={prependEvent} />
      </div>

      {error && (
        <Card className="mb-4 rounded-[1.75rem] bg-card ring-0">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-sm font-medium text-destructive">
              API unavailable. Start the ShaktiOS API to connect live operations.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="text-sm font-medium text-info hover:underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key indicators">
        {loading
          ? [0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)
          : [
              { title: "Active incidents", value: String(active.length).padStart(2, "0"), note: `${elevated.length} elevated`, icon: Activity },
              { title: "Elevated risk", value: String(elevated.length).padStart(2, "0"), note: `${Math.round(averageRisk * 100)}% average`, icon: MapPinned },
              { title: "Signals", value: String(events.length).padStart(2, "0"), note: "Latest retained events", icon: Radio },
              { title: "Fusion", value: connected ? "Live" : "Wait", note: "Incident + event streams", icon: Signal },
            ].map(({ title, value, note, icon: Icon }) => (
              <Card key={title} className="group rounded-[1.75rem] bg-card py-0 ring-0 transition-shadow hover:shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">{title}</p>
                    <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-info" aria-hidden />
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium tracking-[-0.03em]">Live situation map</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Named gates from live incidents</p>
              </div>
              <Link href="/map" className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
                Full map <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4">
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
              <div className="flex items-center gap-2">
                <Badge variant="outline">{active.length}</Badge>
                <Link href="/incidents" className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
                  View all <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && <p className="px-6 py-8 text-sm text-muted-foreground">Loading operational data…</p>}
            {!loading && !active.length && (
              <div className="px-6 py-10 text-center">
                <CheckCircle2 className="mx-auto size-6 text-success" aria-hidden />
                <p className="mt-3 font-medium">No active incidents</p>
              </div>
            )}
            <ScrollArea className="max-h-[380px]">
              <div className="space-y-1 px-3 pb-3">
                {active.slice(0, 8).map((item) => (
                  <Link key={item.id} href={`/incidents/${item.id}`} className="flex items-center justify-between rounded-[1.25rem] px-4 py-4 transition-colors hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium capitalize">{label(item.type)}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPinned className="size-3 shrink-0" aria-hidden />{label(item.location)}</p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-3">
                      <SeverityBadge value={item.severity} />
                      <span className="w-10 text-right text-sm font-medium tabular-nums">{riskPercent(item.risk)}%</span>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium tracking-[-0.03em]">Live activity feed</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Incidents and events in one view</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Link href="/signals" className="inline-flex items-center gap-1 font-medium text-info hover:underline">
                  Signals <ArrowUpRight className="size-3" aria-hidden />
                </Link>
                <Link href="/timeline" className="inline-flex items-center gap-1 font-medium text-info hover:underline">
                  Timeline <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="incidents" className="px-6 pt-4 pb-6">
              <TabsList className="mb-4 rounded-full bg-muted p-1">
                <TabsTrigger className="rounded-full px-4 font-medium" value="incidents">Incidents</TabsTrigger>
                <TabsTrigger className="rounded-full px-4 font-medium" value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="incidents">
                {loading ? (
                  <p className="py-8 text-sm text-muted-foreground">Loading…</p>
                ) : incidents.length === 0 ? (
                  <EmptyState title="No incidents yet" hint="Correlated events will create crowd_risk incidents here." />
                ) : (
                  <ScrollArea className="max-h-[340px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead scope="col">Type</TableHead>
                          <TableHead scope="col">Location</TableHead>
                          <TableHead scope="col">Status</TableHead>
                          <TableHead scope="col" className="text-right">Risk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidents.slice(0, 10).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell><Link href={`/incidents/${item.id}`} className="font-medium capitalize hover:text-info">{label(item.type)}</Link></TableCell>
                            <TableCell className="capitalize text-muted-foreground">{label(item.location)}</TableCell>
                            <TableCell><StatusBadge value={item.status} /></TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{riskPercent(item.risk)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>
              <TabsContent value="events">
                {loading ? (
                  <p className="py-8 text-sm text-muted-foreground">Loading…</p>
                ) : events.length === 0 ? (
                  !error ? (
                    <EmptyState title="No signals have arrived yet" hint="Submit a test signal to verify the full event → incident loop." />
                  ) : (
                    <ErrorState onRetry={refresh} />
                  )
                ) : (
                  <ScrollArea className="max-h-[340px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead scope="col">Type</TableHead>
                          <TableHead scope="col">Location</TableHead>
                          <TableHead scope="col">Source</TableHead>
                          <TableHead scope="col" className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.slice(0, 10).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium capitalize">{label(item.type)}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{label(item.location)}</TableCell>
                            <TableCell className="text-muted-foreground">{item.source}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</TableCell>
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
    </OperatorShell>
  );
}
