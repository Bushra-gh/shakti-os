"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getEvents,
  getIncidentEvents,
  getIncidents,
  getTimeline,
  getVenues,
  websocketUrl,
  type Event,
  type Incident,
  type TimelineEntry,
  type Venue,
} from "@/lib/api";
import { accessToken } from "@/lib/supabase";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";

export type ShaktiData = {
  incidents: Incident[];
  events: Event[];
  venues: Venue[];
  loading: boolean;
  error: boolean;
  incidentState: ConnectionState;
  eventState: ConnectionState;
  connected: boolean;
  refresh: () => void;
  applyIncident: (incident: Incident) => void;
  prependEvent: (event: Event) => void;
};

function mergeIncident(current: Incident[], incident: Incident) {
  const existing = current.find((item) => item.id === incident.id);
  if (existing && existing.updated_at > incident.updated_at) return current;
  return [...current.filter((item) => item.id !== incident.id), incident]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 200);
}

function mergeEvent(current: Event[], event: Event) {
  return [event, ...current.filter((item) => item.id !== event.id)]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200);
}

export function useShaktiData(): ShaktiData {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [incidentState, setIncidentState] = useState<ConnectionState>("CONNECTING");
  const [eventState, setEventState] = useState<ConnectionState>("CONNECTING");
  const [refreshKey, setRefreshKey] = useState(0);
  const incidentUpdates = useRef(new Map<string, Incident>());
  const eventUpdates = useRef(new Map<string, Event>());

  useEffect(() => {
    let cancelled = false;
    incidentUpdates.current.clear();
    eventUpdates.current.clear();
    setLoading(true);
    setError(false);
    Promise.all([getIncidents(), getEvents(), getVenues()])
      .then(([nextIncidents, nextEvents, nextVenues]) => {
        if (cancelled) return;
        // HTTP may have been captured before an event delivered during this read.
        setIncidents([...incidentUpdates.current.values()].reduce(mergeIncident, nextIncidents));
        setEvents([...eventUpdates.current.values()].reduce(mergeEvent, nextEvents));
        setVenues(nextVenues);
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
    const onIncidentState = (state: ConnectionState) => {
      setIncidentState(state);
      // Also reload on first acknowledgement: initial HTTP and WS are not atomic.
      if (state === "LIVE") setRefreshKey((key) => key + 1);
    };
    const onEventState = (state: ConnectionState) => {
      setEventState(state);
      if (state === "LIVE") setRefreshKey((key) => key + 1);
    };
    const stopIncidents = subscribeWithReconnect(
      websocketUrl("/ws/incidents"),
      accessToken,
      (data) => {
        try {
          const update = JSON.parse(data) as { type: string; incident: Incident };
          if (update.type === "incident.updated" && update.incident?.id) {
            incidentUpdates.current.set(update.incident.id, update.incident);
            setIncidents((current) => mergeIncident(current, update.incident));
          }
        } catch {
          // Ignore malformed realtime payloads; the next authenticated reload recovers.
        }
      },
      onIncidentState,
    );
    const stopEvents = subscribeWithReconnect(
      websocketUrl("/ws/events"),
      accessToken,
      (data) => {
        try {
          const update = JSON.parse(data) as { type: string; event: Event };
          if (update.type === "event.created" && update.event?.id) {
            eventUpdates.current.set(update.event.id, update.event);
            setEvents((current) => mergeEvent(current, update.event));
          }
        } catch {
          // Ignore malformed realtime payloads; the next authenticated reload recovers.
        }
      },
      onEventState,
    );
    return () => {
      stopIncidents();
      stopEvents();
    };
  }, []);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const applyIncident = useCallback(
    (incident: Incident) => {
      incidentUpdates.current.set(incident.id, incident);
      setIncidents((current) => mergeIncident(current, incident));
    },
    [],
  );
  const prependEvent = useCallback(
    (event: Event) => {
      eventUpdates.current.set(event.id, event);
      setEvents((current) => mergeEvent(current, event));
    },
    [],
  );

  return {
    incidents,
    events,
    venues,
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

/** Latest request wins, and a departed incident's response can never replace this one. */
function useIncidentResource<T>(incidentId: string | undefined, read: (id: string) => Promise<T[]>, poll = false) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(incidentId));
  const [error, setError] = useState(false);
  const revision = useRef(0);

  const reload = useCallback(async () => {
    const request = ++revision.current;
    if (!incidentId) {
      setData([]);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const next = await read(incidentId);
      if (request === revision.current) setData(next);
    } catch {
      if (request === revision.current) setError(true);
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, [incidentId, read]);

  useEffect(() => {
    setData([]);
    void reload();
    const timer = poll && incidentId ? setInterval(() => void reload(), 15_000) : undefined;
    return () => { revision.current += 1; clearInterval(timer); };
  }, [reload, poll, incidentId]);

  return { data, loading, error, reload, setData };
}

export function useIncidentTimeline(incidentId: string | undefined) {
  const result = useIncidentResource<TimelineEntry>(incidentId, getTimeline, true);
  return { timeline: result.data, loading: result.loading, error: result.error, reload: result.reload, setTimeline: result.setData };
}

export function useIncidentEvents(incidentId: string | undefined) {
  const result = useIncidentResource<Event>(incidentId, getIncidentEvents);
  return { events: result.data, loading: result.loading, error: result.error, reload: result.reload };
}
