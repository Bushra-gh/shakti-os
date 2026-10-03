import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getIncidentEvents,
  getMe,
  getOverview,
  getIntegrations,
  requestIncidentAction,
  submitEvent,
  updateIncidentStatus,
} from "../lib/api";

describe("dashboard API boundaries", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the sanitized public overview without private payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      incident_count: 0,
      active_count: 0,
      elevated_count: 0,
      event_count: 0,
      source_count: 0,
      last_event_at: null,
      incidents: [],
      recent_events: [],
      seeded_event_count: 0,
    }), { status: 200 })));
    await getOverview();
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/public/overview", { cache: "no-store" });
  });

  it("uses authenticated API routes for operator identity and related evidence", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "op-1", email: "op@example.com", role: "operator", is_operator: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ n8n: { configured: false, authenticated: false } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getMe();
    await getIncidentEvents("inc-1");
    await getIntegrations();
    expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:8000/me");
    expect(fetchMock.mock.calls[1]![0]).toBe("http://localhost:8000/incidents/inc-1/events");
    expect(fetchMock.mock.calls[2]![0]).toBe("http://localhost:8000/integrations");
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ headers: expect.any(Headers) }));
    }
  });

  it("submits normalized operator observations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "evt-1" }), { status: 201 })));
    await submitEvent({ type: "citizen_report", source: "operator_observation", location: "zone-1", confidence: 0.9, payload: { description: "Observed obstruction" } });
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/events", expect.objectContaining({ method: "POST" }));
  });

  it("approves status transitions and action handoffs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "inc-1", status: "ASSESSING" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ action_id: "act-1", status: "accepted" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await updateIncidentStatus("inc-1", "ASSESSING", "Review evidence");
    await requestIncidentAction("inc-1", "notify_operator", "Approved");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:8000/incidents/inc-1/status", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:8000/incidents/inc-1/actions", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body)).toEqual({ type: "notify_operator", note: "Approved" });
  });

  it("surfaces backend status and detail on failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Incident must be RESPONDING before requesting an action" }), { status: 409 })));
    const failure = await requestIncidentAction("inc-1", "notify_operator").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(409);
    expect((failure as ApiError).message).toContain("RESPONDING");
  });
});
