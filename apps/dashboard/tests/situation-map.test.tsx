import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Map as LeafletMap } from "leaflet";
import { CircleMarker } from "react-leaflet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Incident, Venue } from "../lib/api";

// jsdom has no SVG renderer. Keep the real map, tiles and controls, while
// recording marker props to verify that the regional view never relocates data.
vi.mock("react-leaflet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-leaflet")>();
  return { ...actual, CircleMarker: vi.fn(() => null) };
});

import SituationMap from "../components/situation-map";

const incident: Incident = {
  id: "map-control-test",
  type: "crowd_risk",
  location: "gate_4",
  latitude: 23.3441,
  longitude: 85.3096,
  status: "DETECTED",
  severity: "HIGH",
  confidence: 0.9,
  risk: 0.75,
  factors: {},
  created_at: "2026-09-19T12:00:00Z",
  updated_at: "2026-09-19T12:00:00Z",
};

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(420);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function renderMap(incidents: Incident[], venues: Venue[] = []) {
  const setView = vi.spyOn(LeafletMap.prototype, "setView");
  const view = render(<SituationMap incidents={incidents} venues={venues} />);
  const map = setView.mock.contexts.find((value) => value instanceof LeafletMap);
  if (!(map instanceof LeafletMap)) throw new Error("Expected a Leaflet map to initialize");
  return { ...view, map };
}

function expectKolkata(map: LeafletMap) {
  expect(map.getCenter().lat).toBeCloseTo(22.525, 5);
  expect(map.getCenter().lng).toBeCloseTo(88.39, 5);
  expect(map.getZoom()).toBe(11);
}

describe("Kolkata and Sonarpur situation maps", () => {
  it.each([320, 800])("includes Kolkata and all five Sonarpur zones in a %ipx-wide initial view", (width) => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
    const { map } = renderMap([]);
    expectKolkata(map);
    expect(screen.getByText("Kolkata & Sonarpur")).toBeInTheDocument();
    const locations: [number, number][] = [
      [22.5726, 88.3639], // Central Kolkata
      [22.603, 88.3683], // Bagbazar
      [22.6026, 88.4011], // Sreebhumi
      [22.4498, 88.4205], // Sonarpur registration
      [22.4506, 88.4220], // Hacking arena
      [22.4515, 88.4235], // Demo stage
      [22.4507, 88.4188], // Food/rest
      [22.4484, 88.4232], // Shuttle arrival
    ];
    for (const coordinate of locations) {
      expect(map.getBounds().contains(coordinate)).toBe(true);
      const point = map.latLngToContainerPoint(coordinate);
      // Leave room around markers instead of barely clipping them into view.
      expect(point.x).toBeGreaterThan(24);
      expect(point.x).toBeLessThan(width - 24);
      expect(point.y).toBeGreaterThan(24);
      expect(point.y).toBeLessThan(420 - 24);
    }
  });

  it("starts in the Kolkata/Sonarpur region despite incidents elsewhere and preserves real marker coordinates", () => {
    const fitBounds = vi.spyOn(LeafletMap.prototype, "fitBounds");
    const { map, rerender } = renderMap([incident]);
    expectKolkata(map);
    expect(vi.mocked(CircleMarker).mock.calls[0]?.[0].center).toEqual([23.3441, 85.3096]);

    rerender(<SituationMap incidents={[incident, { ...incident, id: "delhi", latitude: 28.6139, longitude: 77.209 }]} />);
    expectKolkata(map);
    expect(fitBounds).not.toHaveBeenCalled();

    // Neither status nor coordinate updates should reset a manually chosen view.
    act(() => { map.setView([22.6, 88.4], 13, { animate: false }); });
    rerender(<SituationMap incidents={[{ ...incident, status: "ASSESSING", latitude: 22.603, longitude: 88.3683 }]} />);
    expect(map.getZoom()).toBe(13);
    expect(map.getCenter().lat).toBeCloseTo(22.6, 5);
    expect(map.getCenter().lng).toBeCloseTo(88.4, 5);
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it("keeps native zoom controls, metric scale and attribution while preserving page scrolling", () => {
    const { map, container } = renderMap([incident]);
    const increase = screen.getByRole("button", { name: "Zoom in" });
    const decrease = screen.getByRole("button", { name: "Zoom out" });
    expect(screen.getAllByRole("button", { name: "Zoom in" })).toHaveLength(1);
    fireEvent.click(increase);
    expect(map.getZoom()).toBe(12);
    fireEvent.click(decrease);
    expect(map.getZoom()).toBe(11);
    expect(map.scrollWheelZoom.enabled()).toBe(false);
    expect(map.dragging.enabled()).toBe(true);
    expect(map.keyboard.enabled()).toBe(true);
    const scales = container.querySelectorAll(".leaflet-control-scale-line");
    expect(scales).toHaveLength(1);
    expect(scales[0]?.textContent).toMatch(/\d+ (m|km)$/);
    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  });

  it.each([
    { incidents: [], message: "No active incidents to plot." },
    { incidents: [{ ...incident, latitude: null, longitude: null }], message: "No incident coordinates available." },
  ])("keeps a usable Kolkata/Sonarpur basemap for $message", ({ incidents, message }) => {
    const { map } = renderMap(incidents);
    expectKolkata(map);
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(CircleMarker).not.toHaveBeenCalled();
  });

  it("uses registered zone coordinates without moving the initial view", () => {
    const venues: Venue[] = [{
      id: "kolkata-test", name: "Kolkata Test Venue", venue: "Kolkata", description: "Test fixture",
      locationLabel: "Bagbazar", status: "active", startTime: null, endTime: null, helpline: null,
      zones: [{ id: "kol_bagbazar", label: "Bagbazar", latitude: 22.603, longitude: 88.3683 }],
    }];
    const { map } = renderMap([{ ...incident, location: "kol_bagbazar", latitude: null, longitude: null }], venues);
    expectKolkata(map);
    expect(vi.mocked(CircleMarker).mock.calls[0]?.[0].center).toEqual([22.603, 88.3683]);
  });
});
