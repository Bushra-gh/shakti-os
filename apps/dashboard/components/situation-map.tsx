"use client";

import Link from "next/link";
import { useEffect } from "react";
import { MapContainer, CircleMarker, Popup, ScaleControl, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Incident, Venue } from "@/lib/api";

const severityColor: Record<string, string> = {
  CRITICAL: "var(--severity-critical)",
  HIGH: "var(--severity-high)",
  MEDIUM: "var(--severity-medium)",
  LOW: "var(--severity-low)",
};

const displayLabel = (value: string) => value.replaceAll("_", " ");

type Coordinate = [number, number];

function validCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): Coordinate | undefined {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180
  ) {
    return undefined;
  }
  return [latitude, longitude];
}

function coordinateFor(incident: Incident, venues: Venue[]): Coordinate | undefined {
  const direct = validCoordinate(incident.latitude, incident.longitude);
  if (direct) return direct;

  const location = incident.location.trim().toLowerCase();
  for (const venue of venues) {
    const zone = venue.zones.find((candidate) => candidate.id.toLowerCase() === location);
    const coordinate = zone && validCoordinate(zone.latitude, zone.longitude);
    if (coordinate) return coordinate;
  }
  return undefined;
}

function FitToMarkers({ points }: { points: Coordinate[] }) {
  const map = useMap();
  const coordinates = JSON.stringify(points);
  useEffect(() => {
    const bounds = JSON.parse(coordinates) as Coordinate[];
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    else if (bounds.length === 1) map.setView(bounds[0]!, 15);
  }, [map, coordinates]);
  return null;
}

export default function SituationMap({ incidents, venues = [] }: { incidents: Incident[]; venues?: Venue[] }) {
  const plotted = incidents
    .map((incident) => ({ incident, coordinate: coordinateFor(incident, venues) }))
    .filter((item): item is { incident: Incident; coordinate: Coordinate } => Boolean(item.coordinate));

  if (plotted.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[1.4rem] bg-muted px-6 text-center">
        <div>
          <p className="font-medium">No incident coordinates available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The map only plots coordinates returned by the API or a configured venue zone.
          </p>
        </div>
      </div>
    );
  }

  const center = plotted[0]!.coordinate;
  return (
    <div className="relative isolate min-h-[420px] overflow-hidden rounded-[1.4rem]" role="region" aria-label="Incident situation map">
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        className="h-full min-h-[420px] w-full"
        zoomControl
      >
        <ScaleControl position="bottomleft" imperial={false} />
        <FitToMarkers points={plotted.map(({ coordinate }) => coordinate)} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {plotted.map(({ incident, coordinate }) => (
          <CircleMarker
            key={incident.id}
            center={coordinate}
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
                <p className="text-sm font-semibold capitalize">{displayLabel(incident.type)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{displayLabel(incident.location)}</p>
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
        ))}
      </MapContainer>
    </div>
  );
}
