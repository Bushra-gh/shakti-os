"use client";

import Link from "next/link";
import { MapContainer, CircleMarker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Incident } from "@/lib/api";

const gateCoordinates: Record<string, [number, number]> = {
  gate_1: [23.3441, 85.3096],
  gate_2: [23.3580, 85.3350],
  gate_3: [23.3700, 85.3270],
  gate_4: [23.3350, 85.3150],
  gate_9: [23.3500, 85.3200],
};

const severityColor: Record<string, string> = {
  CRITICAL: "var(--severity-critical)",
  HIGH: "var(--severity-high)",
  MEDIUM: "var(--severity-medium)",
  LOW: "var(--severity-low)",
};

const label = (value: string) => value.replaceAll("_", " ");

const center: [number, number] = [23.3500, 85.3220];

const indiaBounds: [[number, number], [number, number]] = [
  [6.5, 68.0],
  [35.5, 97.5],
];

export default function SituationMap({ incidents }: { incidents: Incident[] }) {
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
