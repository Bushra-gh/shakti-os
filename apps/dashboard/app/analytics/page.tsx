"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperatorShell } from "@/components/dashboard/shell";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/dashboard/states";
import { useShaktiData } from "@/hooks/use-shakti";
import { label, SEVERITIES } from "@/lib/format";

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TrendChart({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(1, ...points);
  const width = 560;
  const height = 160;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((v, i) => `${(i * step).toFixed(1)},${(height - 12 - (v / max) * (height - 32)).toFixed(1)}`);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-40 w-full"
      role="img"
      aria-label={`Trend chart with values ${points.join(", ")}`}
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((point, i) => {
        const [x, y] = point.split(",");
        return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />;
      })}
    </svg>
  );
}

function BarRow({ labelText, value, max, tone }: { labelText: string; value: number; max: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{labelText}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, max)}
        aria-label={labelText}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${max ? Math.round((value / max) * 100) : 0}%`, backgroundColor: tone }}
        />
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  LOW: "var(--severity-low)",
  MEDIUM: "var(--severity-medium)",
  HIGH: "var(--severity-high)",
  CRITICAL: "var(--severity-critical)",
};

export default function AnalyticsPage() {
  const { incidents, events, loading, error, refresh } = useShaktiData();

  const days = useMemo(() => {
    const keys: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return keys;
  }, []);

  const incidentsPerDay = useMemo(
    () => days.map((day) => incidents.filter((i) => dayKey(i.created_at) === day).length),
    [days, incidents],
  );

  const avgRiskPerDay = useMemo(
    () =>
      days.map((day) => {
        const rows = incidents.filter((i) => dayKey(i.created_at) === day);
        if (!rows.length) return 0;
        return Math.round((rows.reduce((s, i) => s + i.risk, 0) / rows.length) * 100);
      }),
    [days, incidents],
  );

  const severityCounts = useMemo(
    () => SEVERITIES.map((s) => ({ severity: s, count: incidents.filter((i) => i.severity === s).length })),
    [incidents],
  );

  const sourceCounts = useMemo(() => {
    const buckets = { crowd: 0, social: 0, citizen: 0, other: 0 };
    for (const e of events) {
      const s = e.source.toLowerCase();
      if (s.includes("crowd") || s.includes("simulator") || s.includes("vision")) buckets.crowd += 1;
      else if (s.includes("civic") || s.includes("social")) buckets.social += 1;
      else if (s.includes("citizen")) buckets.citizen += 1;
      else buckets.other += 1;
    }
    return (Object.entries(buckets) as Array<[keyof typeof buckets, number]>).map(([name, count]) => ({ name, count }));
  }, [events]);

  const topLocations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of incidents) counts.set(i.location, (counts.get(i.location) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [incidents]);

  const resolved = useMemo(() => incidents.filter((i) => i.status === "RESOLVED"), [incidents]);
  const avgResolutionMinutes = useMemo(() => {
    if (!resolved.length) return null;
    const total = resolved.reduce(
      (s, i) => s + (new Date(i.updated_at).getTime() - new Date(i.created_at).getTime()),
      0,
    );
    return Math.round(total / resolved.length / 60000);
  }, [resolved]);

  const activeSources = useMemo(() => new Set(events.map((e) => e.source)).size, [events]);
  const hasData = incidents.length > 0 || events.length > 0;
  const maxSeverity = Math.max(1, ...severityCounts.map((s) => s.count));
  const maxSource = Math.max(1, ...sourceCounts.map((s) => s.count));
  const maxLocation = Math.max(1, ...topLocations.map(([, c]) => c));

  return (
    <OperatorShell>
      <div className="mb-5">
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Analytics & Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trends and operational insights — computed from available backend data only.
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}
      {!loading && error && (
        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <ErrorState onRetry={refresh} />
        </Card>
      )}
      {!loading && !error && !hasData && (
        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <EmptyState
            title="No analytics yet"
            hint="Historical metrics appear once events and incidents exist. No sample statistics are shown."
          />
        </Card>
      )}
      {!loading && !error && hasData && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
            {[
              { title: "Total incidents", value: String(incidents.length), note: `${resolved.length} resolved` },
              { title: "Avg. resolution", value: avgResolutionMinutes === null ? "—" : `${avgResolutionMinutes} min`, note: "Created → last update" },
              { title: "Signals (recent)", value: String(events.length), note: "Latest retained events" },
              { title: "Active sources", value: `${activeSources}`, note: "Distinct source identifiers" },
            ].map((kpi) => (
              <Card key={kpi.title} className="rounded-[1.75rem] bg-card py-0 ring-0">
                <CardContent className="p-6">
                  <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {kpi.title}
                  </p>
                  <p className="mt-4 text-4xl font-medium tracking-[-0.06em]">{kpi.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{kpi.note}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Incident trend</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">New incidents per day, last 7 days</p>
              </CardHeader>
              <CardContent className="p-6">
                <TrendChart points={incidentsPerDay} color="var(--primary)" />
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>{days[0]?.slice(5)}</span>
                  <span>{days[days.length - 1]?.slice(5)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Average risk trend</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Mean risk score (%) per day, last 7 days</p>
              </CardHeader>
              <CardContent className="p-6">
                <TrendChart points={avgRiskPerDay} color="var(--severity-high)" />
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>{days[0]?.slice(5)}</span>
                  <span>{days[days.length - 1]?.slice(5)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Severity distribution</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Current severity across incidents</p>
              </CardHeader>
              <CardContent className="space-y-3.5 p-6">
                {severityCounts.map((s) => (
                  <BarRow
                    key={s.severity}
                    labelText={s.severity}
                    value={s.count}
                    max={maxSeverity}
                    tone={TONES[s.severity] ?? "var(--primary)"}
                  />
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Signal source distribution</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Recent events by source group</p>
              </CardHeader>
              <CardContent className="space-y-3.5 p-6">
                {sourceCounts.map((s, i) => (
                  <BarRow
                    key={s.name}
                    labelText={label(s.name)}
                    value={s.count}
                    max={maxSource}
                    tone={`var(--chart-${(i % 5) + 1})`}
                  />
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-[1.75rem] bg-card py-0 ring-0 lg:col-span-2">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-lg font-medium">Top locations</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Incident count by location</p>
              </CardHeader>
              <CardContent className="grid gap-x-8 gap-y-3.5 p-6 sm:grid-cols-2">
                {topLocations.length === 0 && (
                  <p className="text-sm text-muted-foreground">No locations recorded yet.</p>
                )}
                {topLocations.map(([loc, count]) => (
                  <BarRow
                    key={loc}
                    labelText={label(loc)}
                    value={count}
                    max={maxLocation}
                    tone="var(--primary)"
                  />
                ))}
              </CardContent>
            </Card>
          </section>
          <p className="mt-4 text-xs text-muted-foreground">
            Per-stage response durations (Detected → Assessing → Responding → Resolved) are not yet
            available — the backend records status changes but the dashboard has no aggregation
            endpoint. Resolution time above uses created → last update as a proxy.
          </p>
        </>
      )}
    </OperatorShell>
  );
}
