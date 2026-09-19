"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import styles from "./page.module.css";

type Incident = {
  id: string;
  type: string;
  location: string;
  status: string;
  severity: string;
  confidence: number;
  risk: number;
  factors: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export default function IncidentDetail({ params }: { params: Promise<{ incidentId: string }> }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let websocket: WebSocket | undefined;
    params.then(({ incidentId }) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      websocket = new WebSocket(`${apiUrl.replace(/^http/, "ws")}/ws/incidents`);

      fetch(`${apiUrl}/incidents/${incidentId}`)
        .then((response) => {
          if (!response.ok) throw new Error("Incident request failed");
          return response.json() as Promise<Incident>;
        })
        .then(setIncident)
        .catch(() => setError(true))
        .finally(() => setLoading(false));

      websocket.onmessage = (message) => {
        const update = JSON.parse(message.data) as { type: string; incident: Incident };
        if (update.type === "incident.updated" && update.incident.id === incidentId) {
          setIncident(update.incident);
        }
      };
    });

    return () => websocket?.close();
  }, [params]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.backLink} href="/">← Back to incidents</Link>
        {loading && <p className={styles.message}>Loading incident...</p>}
        {error && <p className={styles.message}>Incident not found or API unavailable.</p>}
        {incident && (
          <>
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>Incident assessment</p>
                <h1>{incident.type.replaceAll("_", " ")}</h1>
                <p className={styles.location}>{incident.location}</p>
              </div>
              <Badge variant="outline">{incident.status}</Badge>
            </header>
            <div className={styles.summaryGrid}>
              <Card><CardHeader><CardTitle>Risk</CardTitle></CardHeader><CardContent className={styles.metric}>{Math.round(incident.risk * 100)}%</CardContent></Card>
              <Card><CardHeader><CardTitle>Severity</CardTitle></CardHeader><CardContent className={styles.metric}>{incident.severity}</CardContent></Card>
              <Card><CardHeader><CardTitle>Confidence</CardTitle></CardHeader><CardContent className={styles.metric}>{Math.round(incident.confidence * 100)}%</CardContent></Card>
            </div>
            <Card className={styles.evidenceCard}>
              <CardHeader><CardTitle>Explainable risk factors</CardTitle></CardHeader>
              <CardContent>
                <div className={styles.factorList}>
                  {Object.entries(incident.factors).map(([factor, value]) => (
                    <div className={styles.factor} key={factor}><span>{factor.replaceAll("_", " ")}</span><strong>{typeof value === "number" ? value.toFixed(2) : value}</strong></div>
                  ))}
                </div>
                <Separator className={styles.separator} />
                <p className={styles.timestamps}>Detected {new Date(incident.created_at).toLocaleString()}<br />Last updated {new Date(incident.updated_at).toLocaleString()}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
