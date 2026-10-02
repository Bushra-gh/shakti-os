import { AlertTriangle, ArrowDown, ArrowUp, Minus, Radio, Smartphone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { label, sourceMeta } from "@/lib/format";
import { cn } from "@/lib/utils";

const severityClass: Record<string, string> = {
  CRITICAL: "border-transparent bg-destructive/10 text-destructive",
  HIGH: "border-transparent bg-info/10 text-info",
  MEDIUM: "border-transparent bg-warning/10 text-warning-foreground",
  LOW: "border-transparent bg-success/10 text-success",
};

const severityIcon: Record<string, typeof Minus> = {
  CRITICAL: AlertTriangle,
  HIGH: ArrowUp,
  MEDIUM: Minus,
  LOW: ArrowDown,
};

/** Severity is never color-alone: label + icon + tone. */
export function SeverityBadge({ value, className }: { value: string; className?: string }) {
  const Icon = severityIcon[value] ?? Minus;
  return (
    <Badge
      variant="outline"
      className={cn(severityClass[value] ?? "border-border text-foreground", className)}
      aria-label={`Severity ${value}`}
    >
      <Icon aria-hidden />
      {value}
    </Badge>
  );
}

const statusClass: Record<string, string> = {
  DETECTED: "border-border text-foreground",
  ASSESSING: "border-transparent bg-warning/10 text-warning-foreground",
  RESPONDING: "border-transparent bg-info/10 text-info",
  RESOLVED: "border-transparent bg-success/10 text-success",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(statusClass[value] ?? "border-border text-foreground", className)}
      aria-label={`Status ${value}`}
    >
      {value}
    </Badge>
  );
}

const sourceIcon: Record<string, typeof Radio> = {
  crowd_simulator: Users,
  iot_sensor: Users,
  camera_analytics: Users,
  civic_shield: Radio,
  citizen_app: Smartphone,
  citizen_report: Smartphone,
  public_app: Smartphone,
  expo_app: Smartphone,
};

function iconForSource(source: string) {
  if (source.includes("civic") || source.includes("social")) return Radio;
  if (source.includes("citizen")) return Smartphone;
  if (source.includes("crowd") || source.includes("simulator")) return Users;
  return sourceIcon[source] ?? Radio;
}

export function SourceBadge({ source, className }: { source: string; className?: string }) {
  const meta = sourceMeta(source);
  const Icon = iconForSource(source);
  return (
    <Badge
      variant="outline"
      className={cn("border-border text-muted-foreground", className)}
      title={`${meta.name} · ${meta.kind}`}
    >
      <Icon aria-hidden />
      {meta.name}
    </Badge>
  );
}

export function EventTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="secondary" className="capitalize" title={`Event type ${type}`}>
      {label(type)}
    </Badge>
  );
}
