"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Event } from "@shaktios/types";
import styles from "./page.module.css";

type Incident = {
  id: string;
  type: string;
  location: string;
  status: string;
  severity: string;
  confidence: number;
  risk: number;
  updated_at: string;
};

const previewEvent: Event = {
  id: "evt_preview_001",
  type: "crowd_density",
  source: "crowd_simulator",
  timestamp: "2026-09-16T09:42:00Z",
  location: "gate_4",
  confidence: 0.95,
  payload: { density: 0.42 },
};

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const websocketUrl = apiUrl.replace(/^http/, "ws") + "/ws/incidents";
    const websocket = new WebSocket(websocketUrl);

    fetch(`${apiUrl}/incidents?limit=20`)
      .then((response) => {
        if (!response.ok) throw new Error("Incident request failed");
        return response.json() as Promise<Incident[]>;
      })
      .then(setIncidents)
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    websocket.onmessage = (message) => {
      const update = JSON.parse(message.data) as { type: string; incident: Incident };
      if (update.type !== "incident.updated") return;
      setIncidents((current) => {
        const existing = current.some((incident) => incident.id === update.incident.id);
        if (existing) {
          return current.map((incident) => incident.id === update.incident.id ? update.incident : incident);
        }
        return [update.incident, ...current].slice(0, 20);
      });
    };

    return () => websocket.close();
  }, []);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>Operational preview / 01</div>
        <h1>SHAKTIOS</h1>
        <p className={styles.subtitle}>Event-Driven Intelligence &amp; Response Platform</p>
        <div className={styles.rule} />
        <div className={styles.contentGrid}>
          <div>
            <p className={styles.kicker}>The signal layer is taking shape.</p>
            <p className={styles.description}>
              A focused workspace for turning real-world signals into clear, accountable response.
              The command center arrives incrementally.
            </p>
          </div>
          <div className={styles.eventPanel}>
            <div className={styles.panelHeader}>
              <span>Latest signal</span>
              <span className={styles.status}>STAGED</span>
            </div>
            <pre>{JSON.stringify(previewEvent, null, 2)}</pre>
          </div>
        </div>
        <section className={styles.incidentSection}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.kicker}>Situation awareness</div>
              <h2>Active incidents</h2>
            </div>
            <span className={styles.count}>{incidents.length.toString().padStart(2, "0")}</span>
          </div>
          {loading && <p className={styles.message}>Loading incidents...</p>}
          {error && <p className={styles.message}>API unavailable. Start the ShaktiOS API to view incidents.</p>}
          {!loading && !error && incidents.length === 0 && (
            <p className={styles.message}>No incidents have been detected yet.</p>
          )}
          {!loading && !error && incidents.length > 0 && (
            <div className={styles.incidentList}>
              {incidents.map((incident) => (
                <Link className={styles.incidentRow} href={`/incidents/${incident.id}`} key={incident.id}>
                  <div>
                    <h3>{incident.type.replaceAll("_", " ")}</h3>
                    <p>{incident.location} / updated {new Date(incident.updated_at).toLocaleTimeString()}</p>
                  </div>
                  <div className={styles.incidentMeta}>
                    <span className={`${styles.badge} ${styles[incident.severity.toLowerCase()]}`}>{incident.severity}</span>
                    <span>{Math.round(incident.risk * 100)}% risk</span>
                    <span>{incident.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
