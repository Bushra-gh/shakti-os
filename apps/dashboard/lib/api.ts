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

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("shaktios-access-token");
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // Anonymous when no session is stored.
  }
  return {};
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string, fallback: string) {
    super(detail ? `${fallback} (${status}): ${detail}` : `${fallback} (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function throwForStatus(response: Response, fallback: string): Promise<never> {
  let detail = "";
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
    else if (body.detail !== undefined) detail = JSON.stringify(body.detail);
  } catch {
    // Non-JSON error body — fall back to the status message.
  }
  throw new ApiError(response.status, detail, fallback);
}

export function websocketUrl(path: string): string {
  return `${apiUrl.replace(/^http/, "ws")}${path}`;
}

/** Same-origin fetch with the operator session token attached when signed in. */
function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
}

export async function getIncidents(): Promise<Incident[]> {
  const response = await apiFetch(`${apiUrl}/incidents?limit=50`);
  if (!response.ok) await throwForStatus(response, "Incident request failed");
  return response.json();
}

export async function getEvents(): Promise<Event[]> {
  const response = await apiFetch(`${apiUrl}/events?limit=50`);
  if (!response.ok) await throwForStatus(response, "Event request failed");
  return response.json();
}

export async function getTimeline(incidentId: string): Promise<TimelineEntry[]> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/timeline?limit=100`);
  if (!response.ok) await throwForStatus(response, "Timeline request failed");
  return response.json();
}

export async function submitEvent(event: Omit<Event, "id" | "timestamp">): Promise<Event> {
  const response = await apiFetch(`${apiUrl}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) await throwForStatus(response, "Event submission failed");
  return response.json();
}

export async function updateIncidentStatus(incidentId: string, status: string, note?: string): Promise<Incident> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  if (!response.ok) await throwForStatus(response, "Status update failed");
  return response.json();
}

export async function requestIncidentAction(incidentId: string, type: string, note?: string): Promise<{ action_id: string; status: string; incident: Incident }> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, note }),
  });
  if (!response.ok) await throwForStatus(response, "Action request failed");
  return response.json();
}
