"use client";

import Link from "next/link";
import { MapContainer, CircleMarker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Incident } from "@/lib/api";

const gateCoordinates: Record<string, [number, number]> = {
  gate_1: [23.3441, 85.3096],
  gate_2: [23.358, 85.335],
  gate_3: [23.37, 85.327],
  gate_4: [23.335, 85.315],
  gate_9: [23.35, 85.32],
  // Kolkata Durga Puja 2026 pandal locations (dummy seed data).
  kol_sreebhumi: [22.5989, 88.4029],
  kol_santosh_mitra: [22.568, 88.3635],
  kol_college_square: [22.5736, 88.3633],
  kol_mohammad_ali_park: [22.5826, 88.3613],
  kol_bagbazar: [22.604, 88.365],
  kol_kumartuli: [22.5999, 88.3594],
  kol_suruchi_sangha: [22.5193, 88.333],
  kol_ekdalia: [22.5235, 88.3656],
  kol_deshapriya_park: [22.5165, 88.3453],
  kol_maddox_square: [22.5258, 88.358],
  kol_chetla_agrani: [22.5035, 88.338],
  kol_dumdum_park: [22.6115, 88.412],
};

const severityColor: Record<string, string> = {
  CRITICAL: "var(--severity-critical)",
  HIGH: "var(--severity-high)",
  MEDIUM: "var(--severity-medium)",
  LOW: "var(--severity-low)",
};

const label = (value: string) => value.replaceAll("_", " ");

const ranchiCenter: [number, number] = [23.35, 85.322];
const kolkataCenter: [number, number] = [22.5726, 88.3639];

const indiaBounds: [[number, number], [number, number]] = [
  [6.5, 68.0],
  [35.5, 97.5],
];

export default function SituationMap({ incidents }: { incidents: Incident[] }) {
  const hasKolkata = incidents.some((incident) => incident.location.startsWith("kol_"));
  const center = hasKolkata ? kolkataCenter : ranchiCenter;
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[1.4rem]">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full min-h-[420px] w-full"
        zoomControl={false}
        maxBounds={indiaBounds}
        maxBoundsViscosity={1.0}
        minZoom={4}
        maxZoom={18}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {incidents.map((incident) => {
          const coords = gateCoordinates[incident.location];
          if (!coords) return null;
          return (
            <CircleMarker
              key={incident.id}
              center={coords}
              radius={incident.severity === "CRITICAL" ? 10 : incident.severity === "HIGH" ? 8 : 6}
              pathOptions={{
                color: severityColor[incident.severity] ?? "var(--severity-medium)",
                fillColor: severityColor[incident.severity] ?? "var(--severity-medium)",
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup className="rounded-xl">
                <div className="min-w-[160px] p-1">
                  <p className="text-sm font-semibold capitalize">{label(incident.type)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{label(incident.location)}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: severityColor[incident.severity] }}
                    />
                    <span className="font-medium">{incident.severity}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{Math.round(incident.risk * 100)}% risk</span>
                  </div>
                  <Link
                    href={`/incidents/${incident.id}`}
                    className="mt-3 inline-block text-xs font-medium text-info hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
