export type Incident = {
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

export type Event = {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  location: string;
  confidence: number;
  payload: Record<string, unknown>;
};

export type TimelineEntry = {
  id: string;
  incident_id: string;
  type: string;
  timestamp: string;
  details: Record<string, string | number>;
};

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function websocketUrl(path: string): string {
  return `${apiUrl.replace(/^http/, "ws")}${path}`;
}

export async function getIncidents(): Promise<Incident[]> {
  const response = await fetch(`${apiUrl}/incidents?limit=50`);
  if (!response.ok) throw new Error("Incident request failed");
  return response.json();
}

export async function getEvents(): Promise<Event[]> {
  const response = await fetch(`${apiUrl}/events?limit=50`);
  if (!response.ok) throw new Error("Event request failed");
  return response.json();
}

export async function getTimeline(incidentId: string): Promise<TimelineEntry[]> {
  const response = await fetch(`${apiUrl}/incidents/${incidentId}/timeline?limit=100`);
  if (!response.ok) throw new Error("Timeline request failed");
  return response.json();
}

export async function submitEvent(event: Omit<Event, "id" | "timestamp">): Promise<Event> {
  const response = await fetch(`${apiUrl}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error("Event submission failed");
  return response.json();
}

export async function updateIncidentStatus(incidentId: string, status: string, note?: string): Promise<Incident> {
  const response = await fetch(`${apiUrl}/incidents/${incidentId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  if (!response.ok) throw new Error("Status update failed");
  return response.json();
}

export async function requestIncidentAction(incidentId: string, type: string, note?: string): Promise<{ action_id: string; status: string; incident: Incident }> {
  const response = await fetch(`${apiUrl}/incidents/${incidentId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, note }),
  });
  if (!response.ok) throw new Error("Action request failed");
  return response.json();
}
