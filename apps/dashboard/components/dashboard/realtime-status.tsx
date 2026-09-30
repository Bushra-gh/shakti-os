"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConnectionState } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const dot: Record<ConnectionState, string> = {
  LIVE: "bg-success",
  CONNECTING: "bg-warning",
  RECONNECTING: "bg-warning",
  DISCONNECTED: "bg-destructive",
};

export function RealtimeStatus({
  incidentState,
  eventState,
  compact,
}: {
  incidentState: ConnectionState;
  eventState: ConnectionState;
  compact?: boolean;
}) {
  const live = incidentState === "LIVE" && eventState === "LIVE";
  const label = live ? "Live" : "Reconnecting";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "flex items-center gap-2 rounded-full bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-sm",
              compact && "px-3 py-1.5",
            )}
          />
        }
      >
        <span className={cn("size-2 rounded-full", live ? dot.LIVE : dot.RECONNECTING)} />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="rounded-xl">
        Incidents: {incidentState.toLowerCase()} · Events: {eventState.toLowerCase()} (in-process
        streams, no replay)
      </TooltipContent>
    </Tooltip>
  );
}
