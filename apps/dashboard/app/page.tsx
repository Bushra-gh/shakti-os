"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { apiUrl, getEvents, getIncidents, websocketUrl, type Event, type Incident } from "@/lib/api";
import styles from "./page.module.css";

const gatePositions: Record<string, { left: string; top: string }> = {
  gate_1: { left: "18%", top: "28%" },
  gate_2: { left: "72%", top: "24%" },
  gate_3: { left: "78%", top: "72%" },
  gate_4: { left: "26%", top: "70%" },
  gate_9: { left: "50%", top: "48%" },
};

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function severityClass(severity: string): string {
  return styles[severity.toLowerCase()] ?? "";
}

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [connectionState, setConnectionState] = useState("CONNECTING");
  const [eventType, setEventType] = useState("crowd_density");
  const [eventLocation, setEventLocation] = useState("gate_4");
  const [sendingEvent, setSendingEvent] = useState(false);
  const [eventSent, setEventSent] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/health`).then((response) => {
        if (!response.ok) throw new Error("Health request failed");
        return response.json() as Promise<{ status: string }>;
      }),
      getIncidents(),
      getEvents(),
    ])
      .then(([, nextIncidents, nextEvents]) => {
        setIncidents(nextIncidents);
        setEvents(nextEvents);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    const incidentSocket = new WebSocket(websocketUrl("/ws/incidents"));
    incidentSocket.onopen = () => setConnectionState("LIVE");
    incidentSocket.onclose = () => setConnectionState("DISCONNECTED");
    incidentSocket.onerror = () => setConnectionState("DISCONNECTED");
    incidentSocket.onmessage = (message) => {
      const update = JSON.parse(message.data) as { type: string; incident: Incident };
      if (update.type !== "incident.updated") return;
      setIncidents((current) => {
        const next = current.some((incident) => incident.id === update.incident.id)
          ? current.map((incident) => incident.id === update.incident.id ? update.incident : incident)
          : [update.incident, ...current];
        return next.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 50);
      });
    };

    const eventSocket = new WebSocket(websocketUrl("/ws/events"));
    eventSocket.onmessage = (message) => {
      const update = JSON.parse(message.data) as { type: string; event: Event };
      if (update.type === "event.created") setEvents((current) => [update.event, ...current].slice(0, 50));
    };

    return () => {
      incidentSocket.close();
      eventSocket.close();
    };
  }, []);

  const submitEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendingEvent(true);
    setEventSent(false);
    try {
      const response = await fetch(`${apiUrl}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: eventType,
          source: "dashboard_demo",
          location: eventLocation,
          confidence: 0.9,
          payload: eventType === "crowd_density" ? { density: 0.72 } : { score: 0.72, velocity: 0.72 },
        }),
      });
      if (!response.ok) throw new Error("Event submission failed");
      const created = await response.json() as Event;
      setEvents((current) => [created, ...current].slice(0, 50));
      setEventSent(true);
    } catch {
      setError(true);
    } finally {
      setSendingEvent(false);
    }
  };

  const activeIncidents = incidents.filter((incident) => incident.status !== "RESOLVED");
  const criticalCount = activeIncidents.filter((incident) => ["HIGH", "CRITICAL"].includes(incident.severity)).length;
  const mapIncidents = useMemo(() => activeIncidents.slice(0, 8), [activeIncidents]);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div><p className={styles.eyebrow}>Operational command center / 02</p><h1>SHAKTIOS</h1></div>
        <div className={styles.connection}><span className={`${styles.liveDot} ${connectionState === "DISCONNECTED" ? styles.offlineDot : ""}`} /> {connectionState} / {apiUrl.replace(/^https?:\/\//, "")}</div>
      </header>
      <div className={styles.rule} />
      <section className={styles.metrics}>
        <Card><CardHeader><CardTitle>Active incidents</CardTitle></CardHeader><CardContent className={styles.metric}>{activeIncidents.length.toString().padStart(2, "0")}</CardContent></Card>
        <Card><CardHeader><CardTitle>Elevated risk</CardTitle></CardHeader><CardContent className={`${styles.metric} ${criticalCount ? styles.alertMetric : ""}`}>{criticalCount.toString().padStart(2, "0")}</CardContent></Card>
        <Card><CardHeader><CardTitle>Signals / latest 50</CardTitle></CardHeader><CardContent className={styles.metric}>{events.length.toString().padStart(2, "0")}</CardContent></Card>
      </section>
      <section className={styles.intakeSection}>
        <Card>
          <CardHeader><CardTitle>Signal intake</CardTitle><p className={styles.cardMeta}>Manual demo event / POST /events</p></CardHeader>
          <CardContent>
            <form className={styles.intakeForm} onSubmit={submitEvent}>
              <label>Signal type<select value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="crowd_density">Crowd density</option><option value="abnormal_movement">Abnormal movement</option><option value="social_concern">Social concern</option><option value="citizen_report">Citizen report</option></select></label>
              <label>Location<Input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} /></label>
              <Button disabled={sendingEvent || !eventLocation.trim()}>{sendingEvent ? "Sending..." : "Submit signal"}</Button>
            </form>
            {eventSent && <p className={styles.successMessage}>Signal accepted. Incident correlation and realtime updates should follow.</p>}
          </CardContent>
        </Card>
      </section>
      {error && <p className={styles.error}>API unavailable. Start the ShaktiOS API to connect the command center.</p>}
      <section className={styles.workspace}>
        <Card className={styles.mapCard}>
          <CardHeader><CardTitle>Location overview</CardTitle><p className={styles.cardMeta}>Live incident positions / named gates</p></CardHeader>
          <CardContent>
            <div className={styles.map}>
              <div className={`${styles.mapRoad} ${styles.roadHorizontal}`} /><div className={`${styles.mapRoad} ${styles.roadVertical}`} />
              <span className={styles.mapLabel}>NORTH PLAZA</span><span className={`${styles.mapLabel} ${styles.southLabel}`}>SOUTH ACCESS</span>
              {mapIncidents.map((incident) => {
                const position = gatePositions[incident.location] ?? { left: "50%", top: "50%" };
                return <Link key={incident.id} href={`/incidents/${incident.id}`} className={`${styles.mapMarker} ${severityClass(incident.severity)}`} style={position} title={`${formatLabel(incident.location)} / ${incident.severity}`}><span />{formatLabel(incident.location)}</Link>;
              })}
              {mapIncidents.length === 0 && <p className={styles.mapEmpty}>No active incidents to plot.</p>}
            </div>
          </CardContent>
        </Card>
        <Card className={styles.incidentCard}>
          <CardHeader><CardTitle>Incident queue</CardTitle><p className={styles.cardMeta}>Correlated situations / newest first</p></CardHeader>
          <CardContent className={styles.queue}>
            {loading && <p className={styles.message}>Loading operational data...</p>}
            {!loading && !error && incidents.length === 0 && <p className={styles.message}>No incidents detected yet.</p>}
            {incidents.map((incident) => <Link className={styles.incidentRow} href={`/incidents/${incident.id}`} key={incident.id}><div><strong>{formatLabel(incident.type)}</strong><span>{formatLabel(incident.location)} / {incident.status}</span></div><div className={styles.rowRight}><Badge className={severityClass(incident.severity)}>{incident.severity}</Badge><strong>{Math.round(incident.risk * 100)}%</strong></div></Link>)}
          </CardContent>
        </Card>
      </section>
      <section className={styles.signalSection}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Evidence intake</p><h2>Latest signals</h2></div><span>{events.length} retained</span></div><Separator />
        <div className={styles.signalList}>{events.slice(0, 8).map((event) => <div className={styles.signalRow} key={event.id}><Badge variant="outline">{formatLabel(event.type)}</Badge><span>{formatLabel(event.location)}</span><span className={styles.signalSource}>{event.source}</span><time>{new Date(event.timestamp).toLocaleTimeString()}</time></div>)}{!loading && events.length === 0 && <p className={styles.message}>No signals have arrived yet.</p>}</div>
      </section>
    </main>
  );
}
