import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Map as LeafletMap } from "leaflet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Incident } from "../lib/api";

// jsdom has no SVG renderer. Keep the real Leaflet map, tiles and controls;
// skip only vector markers so these tests exercise actual control behavior.
vi.mock("react-leaflet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-leaflet")>();
  return { ...actual, CircleMarker: () => null };
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
  // Leaflet's scale and bounds calculations need a non-zero viewport.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(420);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("situation map controls", () => {
  it("uses the native zoom buttons, metric scale and attribution without swallowing page scrolling", () => {
    const zoomIn = vi.spyOn(LeafletMap.prototype, "zoomIn");
    const zoomOut = vi.spyOn(LeafletMap.prototype, "zoomOut");
    const { container, rerender } = render(<SituationMap incidents={[incident]} />);

    const increase = screen.getByRole("button", { name: "Zoom in" });
    const decrease = screen.getByRole("button", { name: "Zoom out" });
    expect(screen.getAllByRole("button", { name: "Zoom in" })).toHaveLength(1);
    fireEvent.click(increase);
    expect(zoomIn).toHaveBeenCalledOnce();
    const map = zoomIn.mock.contexts[0];
    if (!(map instanceof LeafletMap)) throw new Error("Zoom control did not target a Leaflet map");
    expect(map.getZoom()).toBe(16);
    fireEvent.click(decrease);
    expect(zoomOut).toHaveBeenCalledOnce();
    expect(map.getZoom()).toBe(15);
    expect(map.scrollWheelZoom.enabled()).toBe(false);
    expect(map.dragging.enabled()).toBe(true);
    expect(map.keyboard.enabled()).toBe(true);

    const scales = container.querySelectorAll(".leaflet-control-scale-line");
    expect(scales).toHaveLength(1);
    expect(scales[0]?.textContent).toMatch(/\d+ (m|km)$/);
    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");

    // A status-only realtime update must not undo the operator's zoom.
    fireEvent.click(increase);
    rerender(<SituationMap incidents={[{ ...incident, status: "ASSESSING" }]} />);
    expect(map.getZoom()).toBe(16);
  });

  it("keeps the no-coordinate state free of unusable controls", () => {
    render(<SituationMap incidents={[{ ...incident, latitude: null, longitude: null }]} />);
    expect(screen.getByText("No incident coordinates available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
  });
});
