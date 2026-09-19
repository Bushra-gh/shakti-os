"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl, getTimeline, websocketUrl, type Incident, type TimelineEntry } from "@/lib/api";
import styles from "./page.module.css";

export default function IncidentDetail({ params }: { params: Promise<{ incidentId: string }> }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineError, setTimelineError] = useState(false);
  const [incidentId, setIncidentId] = useState<string>();
  const [operatorNote, setOperatorNote] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actionType, setActionType] = useState("notify_operator");
  const [actionState, setActionState] = useState<"idle" | "sending" | "accepted" | "error">("idle");

  useEffect(() => {
    let websocket: WebSocket | undefined;
    params.then(({ incidentId }) => {
      setIncidentId(incidentId);
      websocket = new WebSocket(websocketUrl("/ws/incidents"));

      fetch(`${apiUrl}/incidents/${incidentId}`)
        .then((response) => {
          if (!response.ok) throw new Error("Incident request failed");
          return response.json() as Promise<Incident>;
        })
        .then(setIncident)
        .catch(() => setError(true))
        .finally(() => setLoading(false));

      getTimeline(incidentId)
        .then(setTimeline)
        .catch(() => setTimelineError(true));

      websocket.onmessage = (message) => {
        const update = JSON.parse(message.data) as { type: string; incident: Incident };
        if (update.type === "incident.updated" && update.incident.id === incidentId) {
          setIncident(update.incident);
        }
      };
    });

    return () => websocket?.close();
    }, [params]);

  const approveStatus = async (status: string) => {
    if (!incidentId) return;
    setUpdatingStatus(true);
    setStatusError(false);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const response = await fetch(`${apiUrl}/incidents/${incidentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: operatorNote || undefined }),
      });
      if (!response.ok) throw new Error("Status update failed");
      setIncident(await response.json() as Incident);
      setOperatorNote("");
      const timelineResponse = await fetch(`${apiUrl}/incidents/${incidentId}/timeline?limit=100`);
      if (timelineResponse.ok) setTimeline(await timelineResponse.json() as TimelineEntry[]);
    } catch {
      setStatusError(true);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const requestAction = async () => {
    if (!incidentId) return;
    setActionState("sending");
    try {
      const response = await fetch(`${apiUrl}/incidents/${incidentId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: actionType }),
      });
      if (!response.ok) throw new Error("Action request failed");
      setActionState("accepted");
      setTimeline(await getTimeline(incidentId));
    } catch {
      setActionState("error");
    }
  };

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
            {incident.status !== "RESOLVED" && (
              <Card className={styles.approvalCard}>
                <CardHeader><CardTitle>Operator decision</CardTitle></CardHeader>
                <CardContent>
                  <p className={styles.approvalPrompt}>Review the evidence, then approve the next incident state.</p>
                  <Textarea
                    className={styles.noteInput}
                    placeholder="Optional operator note"
                    value={operatorNote}
                    onChange={(event) => setOperatorNote(event.target.value)}
                    maxLength={500}
                  />
                  <div className={styles.actionRow}>
                    {incident.status === "DETECTED" && <Button disabled={updatingStatus} onClick={() => approveStatus("ASSESSING")}>Begin assessment</Button>}
                    {incident.status === "ASSESSING" && <>
                      <Button disabled={updatingStatus} onClick={() => approveStatus("RESPONDING")}>Approve response</Button>
                      <Button variant="outline" disabled={updatingStatus} onClick={() => approveStatus("RESOLVED")}>Resolve incident</Button>
                    </>}
                    {incident.status === "RESPONDING" && <Button disabled={updatingStatus} onClick={() => approveStatus("RESOLVED")}>Resolve incident</Button>}
                  </div>
                  {statusError && <p className={styles.actionError}>Status update failed. Review the API connection and try again.</p>}
                </CardContent>
              </Card>
            )}
            {incident.status === "RESPONDING" && (
              <Card className={styles.actionCard}>
                <CardHeader><CardTitle>Approved response handoff</CardTitle></CardHeader>
                <CardContent>
                  <p className={styles.approvalPrompt}>Send a human-approved request to the configured n8n workflow.</p>
                  <Input className={styles.actionInput} value={actionType} onChange={(event) => setActionType(event.target.value)} aria-label="Action type" />
                  <Button className={styles.actionButton} disabled={actionState === "sending" || !actionType.trim()} onClick={requestAction}>{actionState === "sending" ? "Sending..." : "Request workflow"}</Button>
                  {actionState === "accepted" && <p className={styles.successMessage}>Workflow request accepted and added to the timeline.</p>}
                  {actionState === "error" && <p className={styles.actionError}>Workflow request failed. Check the n8n configuration and try again.</p>}
                </CardContent>
              </Card>
            )}
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
            <Card className={styles.timelineCard}>
              <CardHeader><CardTitle>Incident timeline</CardTitle></CardHeader>
              <CardContent>
                {timelineError && <p className={styles.message}>Timeline unavailable.</p>}
                {!timelineError && timeline.length === 0 && <p className={styles.message}>No correlated events recorded yet.</p>}
                {!timelineError && timeline.length > 0 && (
                  <div className={styles.timelineList}>
                    {timeline.map((entry) => (
                      <div className={styles.timelineEntry} key={entry.id}>
                        <div className={styles.timelineMarker} />
                        <div>
                          <p className={styles.timelineType}>{entry.type.replaceAll(".", " / ")}</p>
                          <p className={styles.timelineTime}>{new Date(entry.timestamp).toLocaleString()}</p>
                          <p className={styles.timelineDetails}>
                            {String(entry.details.event_type ?? "event").replaceAll("_", " ")} from {String(entry.details.source ?? "unknown source")}
                            {entry.details.risk !== undefined && ` / risk ${Math.round(Number(entry.details.risk) * 100)}%`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
