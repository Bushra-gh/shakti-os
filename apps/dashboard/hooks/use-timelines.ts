"use client";

import { useEffect, useState } from "react";
import { getTimeline, type Incident, type TimelineEntry } from "@/lib/api";

/** Bounded audit history; polling also catches actions that do not update incident timestamps. */
export function useRecentTimelines(incidents: Incident[], max = 15) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const targets = incidents.slice(0, max).map((incident) => incident.id).join("|");
  const revisions = incidents.slice(0, max).map((incident) => incident.updated_at).join("|");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ids = targets ? targets.split("|") : [];
    setLoading(true);
    setError(false);
    const load = async () => {
      try {
        const timelines = await Promise.all(ids.map((id) => getTimeline(id)));
        if (cancelled) return;
        const unique = new Map(timelines.flat().map((entry) => [entry.id, entry]));
        setEntries([...unique.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(load, 15_000);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [targets, revisions]);

  return { entries, loading, error };
}
