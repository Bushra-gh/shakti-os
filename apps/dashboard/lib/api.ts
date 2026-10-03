import { accessToken } from "./supabase";

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
  latitude: number | null;
  longitude: number | null;
};

export type Event = {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  location: string;
  confidence: number;
  payload: Record<string, unknown>;
  incident_id: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type PublicOverviewIncident = Pick<
  Incident,
  "id" | "type" | "location" | "status" | "severity" | "risk" | "updated_at" | "latitude" | "longitude"
>;

export type PublicOverviewEvent = {
  id: string;
  type: string;
  source: string;
  location: string;
  timestamp: string;
};

export type PublicOverview = {
  incident_count: number;
  active_count: number;
  elevated_count: number;
  event_count: number;
  source_count: number;
  last_event_at: string | null;
  incidents: PublicOverviewIncident[];
  recent_events: PublicOverviewEvent[];
  seeded_event_count: number;
};

export type TimelineEntry = {
  id: string;
  incident_id: string;
  type: string;
  timestamp: string;
  details: Record<string, string | number>;
};

export type VenueZone = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type Venue = {
  id: string;
  name: string;
  description: string;
  venue: string;
  locationLabel: string;
  zones: VenueZone[];
  status: string;
  startTime: string | null;
  endTime: string | null;
  helpline: string | null;
};

export type Me = {
  id: string;
  email: string | null;
  role: string;
  is_operator: boolean;
};

export type Integrations = {
  n8n: {
    configured: boolean;
    authenticated: boolean;
  };
};

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

/** Authenticated API fetch using the current live Supabase session. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

/** Public, sanitized landing-page overview. Never includes event payloads. */
export async function getOverview(): Promise<PublicOverview> {
  const response = await fetch(`${apiUrl}/public/overview`, { cache: "no-store" });
  if (!response.ok) await throwForStatus(response, "Public overview request failed");
  return response.json();
}

export async function getMe(): Promise<Me> {
  const response = await apiFetch(`${apiUrl}/me`);
  if (!response.ok) await throwForStatus(response, "Operator session request failed");
  return response.json();
}

export async function getIncidents(): Promise<Incident[]> {
  const response = await apiFetch(`${apiUrl}/incidents?limit=200`);
  if (!response.ok) await throwForStatus(response, "Incident request failed");
  return response.json();
}

export async function getIncident(incidentId: string): Promise<Incident> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}`);
  if (!response.ok) await throwForStatus(response, "Incident request failed");
  return response.json();
}

export async function getEvents(): Promise<Event[]> {
  const response = await apiFetch(`${apiUrl}/events?limit=200`);
  if (!response.ok) await throwForStatus(response, "Event request failed");
  return response.json();
}

export async function getIncidentEvents(incidentId: string): Promise<Event[]> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/events`);
  if (!response.ok) await throwForStatus(response, "Incident events request failed");
  return response.json();
}

export async function getTimeline(incidentId: string): Promise<TimelineEntry[]> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/timeline?limit=100`);
  if (!response.ok) await throwForStatus(response, "Timeline request failed");
  return response.json();
}

export async function getVenues(): Promise<Venue[]> {
  const response = await apiFetch(`${apiUrl}/venues`);
  if (!response.ok) await throwForStatus(response, "Venue request failed");
  return response.json();
}

export async function getIntegrations(): Promise<Integrations> {
  const response = await apiFetch(`${apiUrl}/integrations`);
  if (!response.ok) await throwForStatus(response, "Integration request failed");
  return response.json();
}

export async function submitEvent(
  event: Omit<Event, "id" | "timestamp" | "incident_id">,
): Promise<Event> {
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

export async function requestIncidentAction(
  incidentId: string,
  type: string,
  note?: string,
): Promise<{ action_id: string; status: string; incident: Incident }> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, note }),
  });
  if (!response.ok) await throwForStatus(response, "Action request failed");
  return response.json();
}
