import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, requestIncidentAction, submitEvent, updateIncidentStatus } from "../lib/api";

describe("dashboard API writes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("submits normalized events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "evt-1" }), { status: 201 })));
    await submitEvent({ type: "crowd_density", source: "dashboard_demo", location: "gate_4", confidence: 0.9, payload: { density: 0.72 } });
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Incident must be RESPONDING before requesting an action" }), { status: 409 }),
      ),
    );
    const failure = await requestIncidentAction("inc-1", "notify_operator").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(409);
    expect((failure as ApiError).message).toContain("RESPONDING");
  });
});
