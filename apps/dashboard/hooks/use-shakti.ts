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
  return [...current.filter((item) => item.id !== incident.id), incident]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 200);
}

function mergeEvent(current: Event[], event: Event) {
  return [event, ...current.filter((item) => item.id !== event.id)].slice(0, 200);
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
  const hadLiveIncidentStream = useRef(false);
  const hadLiveEventStream = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([getIncidents(), getEvents(), getVenues()])
      .then(([nextIncidents, nextEvents, nextVenues]) => {
        if (cancelled) return;
        setIncidents(nextIncidents);
        setEvents(nextEvents);
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
      if (state === "LIVE") {
        if (hadLiveIncidentStream.current) setRefreshKey((key) => key + 1);
        hadLiveIncidentStream.current = true;
      }
    };
    const onEventState = (state: ConnectionState) => {
      setEventState(state);
      if (state === "LIVE") {
        if (hadLiveEventStream.current) setRefreshKey((key) => key + 1);
        hadLiveEventStream.current = true;
      }
    };
    const stopIncidents = subscribeWithReconnect(
      websocketUrl("/ws/incidents"),
      accessToken,
      (data) => {
        try {
          const update = JSON.parse(data) as { type: string; incident: Incident };
          if (update.type === "incident.updated" && update.incident?.id) {
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
    (incident: Incident) => setIncidents((current) => mergeIncident(current, incident)),
    [],
  );
  const prependEvent = useCallback(
    (event: Event) => setEvents((current) => mergeEvent(current, event)),
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

export function useIncidentTimeline(incidentId: string | undefined) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(incidentId));
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!incidentId) {
      setTimeline([]);
      setLoading(false);
      return;
    }
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
    if (!incidentId) return;
    const interval = setInterval(reload, 15_000);
    return () => clearInterval(interval);
  }, [reload, incidentId]);

  return { timeline, loading, error, reload, setTimeline };
}

export function useIncidentEvents(incidentId: string | undefined) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(Boolean(incidentId));
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!incidentId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setEvents(await getIncidentEvents(incidentId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, loading, error, reload };
}
