"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    apiUrl,
    getTimeline,
    requestIncidentAction,
    updateIncidentStatus,
    websocketUrl,
    type Incident,
    type TimelineEntry,
} from "@/lib/api";
import { subscribeWithReconnect, type ConnectionState } from "@/lib/realtime";

const label = (value: string) => value.replaceAll("_", " ");

export default function IncidentDetail({
    params,
}: {
    params: Promise<{ incidentId: string }>;
}) {
    const [incident, setIncident] = useState<Incident | null>(null);
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
    const [incidentId, setIncidentId] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [timelineError, setTimelineError] = useState(false);
    const [statusError, setStatusError] = useState(false);
    const [actionState, setActionState] = useState("idle");
    const [note, setNote] = useState("");
    const [actionType, setActionType] = useState("notify_operator");
    const [connection, setConnection] = useState<ConnectionState>("CONNECTING");

    useEffect(() => {
        let stop: (() => void) | undefined;
        params.then(({ incidentId: id }) => {
            setIncidentId(id);
            stop = subscribeWithReconnect(
                websocketUrl("/ws/incidents"),
                (data) => {
                    const update = JSON.parse(data) as {
                        type: string;
                        incident: Incident;
                    };
                    if (
                        update.type === "incident.updated" &&
                        update.incident.id === id
                    )
                        setIncident(update.incident);
                },
                setConnection,
            );
            fetch(`${apiUrl}/incidents/${id}`)
                .then((response) => {
                    if (!response.ok) throw new Error();
                    return response.json() as Promise<Incident>;
                })
                .then(setIncident)
                .catch(() => setError(true))
                .finally(() => setLoading(false));
            getTimeline(id)
                .then(setTimeline)
                .catch(() => setTimelineError(true));
        });
        return () => stop?.();
    }, [params]);

    const changeStatus = async (status: string) => {
        if (!incidentId) return;
        setStatusError(false);
        try {
            setIncident(
                await updateIncidentStatus(
                    incidentId,
                    status,
                    note || undefined,
                ),
            );
            setNote("");
            setTimeline(await getTimeline(incidentId));
        } catch {
            setStatusError(true);
        }
    };
    const requestAction = async () => {
        if (!incidentId) return;
        setActionState("sending");
        try {
            await requestIncidentAction(
                incidentId,
                actionType,
                note || undefined,
            );
            setActionState("accepted");
            setTimeline(await getTimeline(incidentId));
        } catch {
            setActionState("error");
        }
    };

    return (
        <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--foreground)] sm:px-12">
            <div className="mx-auto max-w-5xl">
                <Link
                    className="font-mono text-xs uppercase tracking-[.06em] text-[var(--accent-dark)]"
                    href="/"
                >
                    ← Back to incidents
                </Link>
                {loading && (
                    <p className="mt-14 text-[var(--muted)]">
                        Loading incident...
                    </p>
                )}
                {error && (
                    <p className="mt-14 text-[var(--accent-dark)]">
                        Incident not found or API unavailable.
                    </p>
                )}
                {incident && (
                    <>
                        <header className="mb-8 mt-14 flex items-start justify-between gap-6">
                            <div>
                                <p className="font-mono text-xs uppercase tracking-[.06em] text-[var(--accent-dark)]">
                                    Incident assessment
                                </p>
                                <h1 className="mt-3 text-5xl font-bold capitalize tracking-[-.05em] sm:text-7xl">
                                    {label(incident.type)}
                                </h1>
                                <p className="mt-2 font-mono text-sm uppercase text-[var(--muted)]">
                                    {incident.location}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant="outline">
                                    {incident.status}
                                </Badge>
                                <span className="font-mono text-[.65rem] uppercase text-[var(--muted)]">
                                    {connection}
                                </span>
                            </div>
                        </header>
                        {incident.status !== "RESOLVED" && (
                            <Card className="mb-4 border-[var(--accent)]">
                                <CardHeader>
                                    <CardTitle>Operator decision</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-[var(--muted)]">
                                        Review the evidence, then approve the
                                        next incident state.
                                    </p>
                                    <Textarea
                                        className="mt-4 min-h-20"
                                        placeholder="Optional operator note"
                                        value={note}
                                        onChange={(event) =>
                                            setNote(event.target.value)
                                        }
                                        maxLength={500}
                                    />
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {incident.status === "DETECTED" && (
                                            <Button
                                                onClick={() =>
                                                    changeStatus("ASSESSING")
                                                }
                                            >
                                                Begin assessment
                                            </Button>
                                        )}
                                        {incident.status === "ASSESSING" && (
                                            <>
                                                <Button
                                                    onClick={() =>
                                                        changeStatus(
                                                            "RESPONDING",
                                                        )
                                                    }
                                                >
                                                    Approve response
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        changeStatus("RESOLVED")
                                                    }
                                                >
                                                    Resolve incident
                                                </Button>
                                            </>
                                        )}
                                        {incident.status === "RESPONDING" && (
                                            <Button
                                                onClick={() =>
                                                    changeStatus("RESOLVED")
                                                }
                                            >
                                                Resolve incident
                                            </Button>
                                        )}
                                    </div>
                                    {statusError && (
                                        <p className="mt-3 text-xs text-[var(--accent-dark)]">
                                            Status update failed. Try again.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                        {incident.status === "RESPONDING" && (
                            <Card className="mb-4 border-[var(--accent-dark)]">
                                <CardHeader>
                                    <CardTitle>
                                        Approved response handoff
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-[var(--muted)]">
                                        Send a human-approved request to the
                                        configured n8n workflow.
                                    </p>
                                    <Input
                                        className="mt-4 max-w-xs"
                                        value={actionType}
                                        onChange={(event) =>
                                            setActionType(event.target.value)
                                        }
                                    />
                                    <Button
                                        className="mt-3"
                                        disabled={actionState === "sending"}
                                        onClick={requestAction}
                                    >
                                        {actionState === "sending"
                                            ? "Sending..."
                                            : "Request workflow"}
                                    </Button>
                                    {actionState === "accepted" && (
                                        <p className="mt-3 text-xs text-[#3f8d59]">
                                            Workflow request accepted and added
                                            to the timeline.
                                        </p>
                                    )}
                                    {actionState === "error" && (
                                        <p className="mt-3 text-xs text-[var(--accent-dark)]">
                                            Workflow request failed. Check n8n
                                            configuration.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                        <section className="grid gap-4 sm:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Risk</CardTitle>
                                </CardHeader>
                                <CardContent className="text-3xl font-bold">
                                    {Math.round(incident.risk * 100)}%
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Severity</CardTitle>
                                </CardHeader>
                                <CardContent className="text-3xl font-bold uppercase">
                                    {incident.severity}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Confidence</CardTitle>
                                </CardHeader>
                                <CardContent className="text-3xl font-bold">
                                    {Math.round(incident.confidence * 100)}%
                                </CardContent>
                            </Card>
                        </section>
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle>Explainable risk factors</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3">
                                    {Object.entries(incident.factors).map(
                                        ([factor, value]) => (
                                            <div
                                                className="flex justify-between gap-5 capitalize"
                                                key={factor}
                                            >
                                                <span>{label(factor)}</span>
                                                <strong>
                                                    {typeof value === "number"
                                                        ? value.toFixed(2)
                                                        : value}
                                                </strong>
                                            </div>
                                        ),
                                    )}
                                </div>
                                <Separator className="my-6" />
                                <p className="font-mono text-xs uppercase leading-7 text-[var(--muted)]">
                                    Detected{" "}
                                    {new Date(
                                        incident.created_at,
                                    ).toLocaleString()}
                                    <br />
                                    Last updated{" "}
                                    {new Date(
                                        incident.updated_at,
                                    ).toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle>Incident timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {timelineError && (
                                    <p className="text-sm text-[var(--accent-dark)]">
                                        Timeline unavailable.
                                    </p>
                                )}
                                {!timelineError && !timeline.length && (
                                    <p className="text-sm text-[var(--muted)]">
                                        No timeline entries recorded yet.
                                    </p>
                                )}
                                <div className="grid gap-6">
                                    {timeline.map((entry) => (
                                        <div
                                            className="grid grid-cols-[12px_1fr] gap-3"
                                            key={entry.id}
                                        >
                                            <span className="mt-1 size-2 rounded-full bg-[var(--accent-dark)]" />
                                            <div>
                                                <p className="font-mono text-xs font-bold uppercase">
                                                    {entry.type.replaceAll(
                                                        ".",
                                                        " / ",
                                                    )}
                                                </p>
                                                <p className="mt-1 font-mono text-[.7rem] uppercase text-[var(--muted)]">
                                                    {new Date(
                                                        entry.timestamp,
                                                    ).toLocaleString()}
                                                </p>
                                                <p className="mt-1 text-sm text-[var(--muted)]">
                                                    {String(
                                                        entry.details
                                                            .event_type ??
                                                            entry.details
                                                                .action_type ??
                                                            "event",
                                                    )}{" "}
                                                    from{" "}
                                                    {String(
                                                        entry.details.source ??
                                                            entry.details
                                                                .delivery ??
                                                            "operator",
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </main>
    );
}
