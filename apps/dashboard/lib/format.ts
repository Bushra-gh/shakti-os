export const label = (value: string) => value.replaceAll("_", " ");

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function riskPercent(risk: number) {
  return Math.round(risk * 100);
}

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function severityForRisk(risk: number): Severity {
  if (risk >= 0.85) return "CRITICAL";
  if (risk >= 0.7) return "HIGH";
  if (risk >= 0.4) return "MEDIUM";
  return "LOW";
}

export const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const STATUSES = ["DETECTED", "ASSESSING", "RESPONDING", "RESOLVED"] as const;

export type IncidentStatus = (typeof STATUSES)[number];

/** Allowed operator-approved transitions. Backend remains authoritative. */
export const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  DETECTED: ["ASSESSING"],
  ASSESSING: ["RESPONDING", "RESOLVED"],
  RESPONDING: ["RESOLVED"],
  RESOLVED: [],
};

export const EVENT_TYPES = [
  "crowd_density",
  "abnormal_movement",
  "social_concern",
  "citizen_report",
] as const;

/** Deterministic risk weights from the backend risk engine. */
export const RISK_WEIGHTS: Record<string, number> = {
  crowd_density: 0.4,
  social_velocity: 0.3,
  abnormal_movement: 0.2,
  citizen_reports: 0.1,
};

export const FACTOR_LABELS: Record<string, string> = {
  crowd_density: "Crowd Density",
  social_velocity: "Social Velocity",
  abnormal_movement: "Abnormal Movement",
  citizen_reports: "Citizen Reports",
  citizen_report_count: "Citizen Report Count",
};

const SOURCE_META: Record<string, { name: string; kind: string }> = {
  crowd_simulator: { name: "Crowd Simulator", kind: "Generated simulation" },
  iot_sensor: { name: "IoT Crowd Sensor", kind: "Physical sensor" },
  camera_analytics: { name: "Camera Analytics", kind: "Physical sensor" },
  civic_shield: { name: "Social Intelligence", kind: "Civic-Shield boundary" },
  citizen_app: { name: "Citizen Report", kind: "Citizen mobile app" },
  citizen_report: { name: "Citizen Report", kind: "Citizen mobile app" },
  public_app: { name: "Citizen Report", kind: "Citizen mobile app" },
  expo_app: { name: "Citizen Report", kind: "Citizen mobile app" },
  dashboard_observation: { name: "Operator observation", kind: "Authenticated operator" },
};

export function sourceMeta(source: string) {
  return (
    SOURCE_META[source] ?? {
      name: label(source),
      kind: "External source",
    }
  );
}

export function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
