"use client";

import { useMemo } from "react";
import { Activity, Radio, Smartphone, Users, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperatorShell } from "@/components/dashboard/shell";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { formatFullDateTime, label, sourceMeta, timeAgo } from "@/lib/format";

function iconFor(source: string) {
  const s = source.toLowerCase();
  if (s.includes("crowd") || s.includes("simulator") || s.includes("vision")) return Users;
  if (s.includes("civic") || s.includes("social")) return Radio;
  if (s.includes("citizen")) return Smartphone;
  if (s.includes("dashboard") || s.includes("demo")) return Wrench;
  return Activity;
}

const BOUNDARY_NOTES: Array<{ title: string; body: string }> = [
  {
    title: "Crowd simulator",
    body: "Deterministic local generator posting crowd_density and abnormal_movement events. A source channel, not a production sensor network.",
  },
  {
    title: "Civic-Shield boundary",
    body: "External social-intelligence output is normalized through the civic-shield adapter into social_concern events. Source fetching stays outside ShaktiOS — only the adapter boundary is implemented.",
  },
  {
    title: "Citizen reports",
    body: "The citizen mobile app submits citizen_report events via POST /events with Supabase Auth. Reporter identity is stamped server-side and never forwarded from client input.",
  },
];

export default function SourcesPage() {
  const { events, loading, error, refresh } = useShaktiData();

  const groups = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const list = map.get(e.source) ?? [];
      list.push(e);
      map.set(e.source, list);
    }
    return [...map.entries()]
      .map(([source, list]) => {
        const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const latest = sorted[0]!;
        const avgConfidence = list.reduce((s, e) => s + e.confidence, 0) / list.length;
        const linkedIncidents = new Set(list.map((event) => event.incident_id).filter((id): id is string => Boolean(id)));
        return { source, count: list.length, latest, avgConfidence, linkedIncidents: linkedIncidents.size };
      })
      .sort((a, b) => b.count - a.count);
  }, [events]);

  return (
    <OperatorShell>
      <div className="mb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Source Intelligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Health, connection state, and latest activity from each source.
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}
      {!loading && error && (
        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <ErrorState onRetry={refresh} />
        </Card>
      )}
      {!loading && !error && groups.length === 0 && (
        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <EmptyState
            title="No sources observed yet"
            hint="Sources appear here once their events reach the backend."
          />
        </Card>
      )}
      {!loading && !error && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => {
            const Icon = iconFor(g.source);
            const meta = sourceMeta(g.source);
            return (
              <Card key={g.source} className="rounded-[1.75rem] bg-card py-0 ring-0">
                <CardHeader className="px-6 pt-6 pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div>
                        <CardTitle className="text-base font-medium">{meta.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {meta.kind} · <span className="font-mono">{g.source}</span>
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-success/40 text-success">
                      <span className="mr-1.5 size-1.5 rounded-full bg-success" aria-hidden />
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 p-6">
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Events (latest 50 retained)
                    </p>
                    <p className="mt-1 text-2xl font-medium tabular-nums">{g.count}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Avg. confidence
                    </p>
                    <p className="mt-1 text-2xl font-medium tabular-nums">
                      {Math.round(g.avgConfidence * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Linked incidents
                    </p>
                    <p className="mt-1 text-2xl font-medium tabular-nums">{g.linkedIncidents}</p>
                  </div>
                  <div className="col-span-3 rounded-2xl bg-muted p-3.5 text-xs leading-6">
                    <p>
                      Latest: <span className="font-medium capitalize">{label(g.latest.type)}</span>{" "}
                      at <span className="font-medium capitalize">{label(g.latest.location)}</span>{" "}
                      · {timeAgo(g.latest.timestamp)}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{formatFullDateTime(g.latest.timestamp)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-4 rounded-[1.75rem] bg-card py-0 ring-0">
        <CardHeader className="px-6 pt-6 pb-0">
          <CardTitle className="text-lg font-medium">Source boundaries</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            What each channel is — and is not.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 p-6 md:grid-cols-3">
          {BOUNDARY_NOTES.map((n) => (
            <div key={n.title} className="rounded-2xl bg-muted p-4">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{n.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </OperatorShell>
  );
}
