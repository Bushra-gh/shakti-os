"use client";

import { useEffect, useState } from "react";
import type { Incident, TimelineEntry } from "@/lib/api";
import { getTimeline } from "@/lib/api";

/** Fetches timelines for the N most recently updated incidents. */
export function useRecentTimelines(incidents: Incident[], max = 15) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [eventToIncident, setEventToIncident] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const targets = incidents.slice(0, max);
    if (targets.length === 0) {
      setEntries([]);
      setEventToIncident({});
      return;
    }
    setLoading(true);
    Promise.allSettled(targets.map((i) => getTimeline(i.id))).then((results) => {
      if (cancelled) return;
      const all: TimelineEntry[] = [];
      const mapping: Record<string, string> = {};
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const entry of result.value) {
          all.push(entry);
          const eventId = entry.details.event_id;
          if (typeof eventId === "string" && !(eventId in mapping)) {
            mapping[eventId] = entry.incident_id;
          }
        }
      }
      all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setEntries(all);
      setEventToIncident(mapping);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents.map((i) => `${i.id}:${i.updated_at}`).join("|")]);

  return { entries, eventToIncident, loading };
}
