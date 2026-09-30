"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apiUrl,
  getEvents,
  getIncidents,
  getTimeline,
  websocketUrl,
  type Event,
  type Incident,
  type TimelineEntry,
} from "@/lib/api";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";

export type ShaktiData = {
  incidents: Incident[];
  events: Event[];
  loading: boolean;
  error: boolean;
  incidentState: ConnectionState;
  eventState: ConnectionState;
  connected: boolean;
  refresh: () => void;
  applyIncident: (incident: Incident) => void;
  prependEvent: (event: Event) => void;
};

export function useShaktiData(): ShaktiData {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [incidentState, setIncidentState] = useState<ConnectionState>("CONNECTING");
  const [eventState, setEventState] = useState<ConnectionState>("CONNECTING");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([fetch(`${apiUrl}/health`), getIncidents(), getEvents()])
      .then(async ([health, nextIncidents, nextEvents]) => {
        if (cancelled) return;
        if (!health.ok) throw new Error("Health check failed");
        setIncidents(nextIncidents);
        setEvents(nextEvents);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const stopIncidents = subscribeWithReconnect(
      websocketUrl("/ws/incidents"),
      (data) => {
        try {
          const update = JSON.parse(data) as { type: string; incident: Incident };
          if (update.type === "incident.updated") {
            setIncidents((current) =>
              [...current.filter((item) => item.id !== update.incident.id), update.incident]
                .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                .slice(0, 100),
            );
          }
        } catch {
          // Ignore malformed realtime payloads; the next refresh recovers.
        }
      },
      setIncidentState,
    );
    const stopEvents = subscribeWithReconnect(
      websocketUrl("/ws/events"),
      (data) => {
        try {
          const update = JSON.parse(data) as { type: string; event: Event };
          if (update.type === "event.created")
            setEvents((current) => [update.event, ...current].slice(0, 100));
        } catch {
          // Ignore malformed realtime payloads; the next refresh recovers.
        }
      },
      setEventState,
    );
    return () => {
      stopIncidents();
      stopEvents();
    };
  }, []);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const applyIncident = useCallback(
    (incident: Incident) =>
      setIncidents((current) =>
        [...current.filter((item) => item.id !== incident.id), incident]
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, 100),
      ),
    [],
  );
  const prependEvent = useCallback(
    (event: Event) => setEvents((current) => [event, ...current].slice(0, 100)),
    [],
  );

  return {
    incidents,
    events,
    loading,
    error,
    incidentState,
    eventState,
    connected: incidentState === "LIVE" && eventState === "LIVE",
    refresh,
    applyIncident,
    prependEvent,
  };
}

export function useIncidentTimeline(incidentId: string | undefined) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    setError(false);
    try {
      setTimeline(await getTimeline(incidentId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { timeline, loading, error, reload, setTimeline };
}
