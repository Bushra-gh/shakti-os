import Link from "next/link";
import {
  Bell,
  FileText,
  Gauge,
  GitCommitHorizontal,
  Info,
  ShieldCheck,
} from "lucide-react";
import type { TimelineEntry } from "@/lib/api";
import { formatFullDateTime, label } from "@/lib/format";
import { cn } from "@/lib/utils";

const ENTRY_META: Record<string, { icon: typeof Info; tone: string }> = {
  "event.correlated": { icon: GitCommitHorizontal, tone: "bg-info/10 text-info" },
  "status.changed": { icon: ShieldCheck, tone: "bg-warning/10 text-warning-foreground" },
  "action.requested": { icon: Bell, tone: "bg-primary/10 text-primary" },
  "risk.updated": { icon: Gauge, tone: "bg-destructive/10 text-destructive" },
  "severity.updated": { icon: Gauge, tone: "bg-destructive/10 text-destructive" },
  "operator.note": { icon: FileText, tone: "bg-success/10 text-success" },
};

function metaFor(type: string) {
  return ENTRY_META[type] ?? { icon: Info, tone: "bg-muted text-muted-foreground" };
}

function describe(entry: TimelineEntry) {
  const d = entry.details;
  switch (entry.type) {
    case "event.correlated":
      return `${label(String(d.event_type ?? "signal"))} from ${String(d.source ?? "unknown source")} · severity ${String(d.severity ?? "—")} · risk ${d.risk ?? "—"}`;
    case "status.changed":
      return `${String(d.from_status ?? "?")} → ${String(d.to_status ?? "?")}${d.note ? ` — ${String(d.note)}` : ""}`;
    case "action.requested":
      return `${String(d.action_type ?? "action")} · delivery ${String(d.delivery ?? "unknown")}${d.note ? ` — ${String(d.note)}` : ""}`;
    default:
      return Object.entries(d)
        .map(([k, v]) => `${label(k)}: ${String(v)}`)
        .join(" · ");
  }
}

export function TimelineView({
  entries,
  showIncidentLink,
}: {
  entries: TimelineEntry[];
  showIncidentLink?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground" role="status">
        No timeline entries recorded yet.
      </p>
    );
  }
  return (
    <ol className="relative space-y-0">
      {entries.map((entry, index) => {
        const meta = metaFor(entry.type);
        const Icon = meta.icon;
        const last = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                className="absolute top-9 left-[15px] h-[calc(100%-2rem)] w-px bg-border"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                meta.tone,
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium">{entry.type.replaceAll(".", " / ")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatFullDateTime(entry.timestamp)}
              </p>
              <p className="mt-1 text-sm break-words text-muted-foreground">{describe(entry)}</p>
              {showIncidentLink && (
                <Link
                  href={`/incidents/${entry.incident_id}`}
                  className="mt-1 inline-block text-xs font-medium text-info hover:underline"
                >
                  Open incident →
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
