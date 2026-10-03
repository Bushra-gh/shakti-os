import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeWithReconnect } from "../lib/realtime";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  sent: string[] = [];
  onopen?: () => void;
  onclose?: () => void;
  onerror?: () => void;
  onmessage?: (message: { data: string }) => void;
  constructor() { FakeWebSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.onclose?.(); }
}

describe("realtime subscriptions", () => {
  afterEach(() => { FakeWebSocket.instances = []; vi.useRealTimers(); });

  it("authenticates first, forwards messages, and reconnects after close", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const states: string[] = [];
    const messages: string[] = [];
    const stop = subscribeWithReconnect(
      "ws://localhost/ws/events",
      async () => "jwt-token",
      (data: string) => messages.push(data),
      (state) => states.push(state),
    );
    await Promise.resolve();
    const first = FakeWebSocket.instances[0]!;
    first.onopen?.();
    expect(states).not.toContain("LIVE");
    first.onmessage?.({ data: JSON.stringify({ type: "authenticated" }) });
    first.onmessage?.({ data: "event.created" });
    expect(first.sent).toEqual([JSON.stringify({ type: "authenticate", token: "jwt-token" })]);
    first.onclose?.();
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(messages).toEqual(["event.created"]);
    expect(states).toContain("LIVE");
    expect(states).toContain("RECONNECTING");
    stop();
  });

  it("does not open an anonymous socket when the session has no token", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const stop = subscribeWithReconnect("ws://localhost/ws/events", async () => null, () => {}, () => {});
    await Promise.resolve();
    expect(FakeWebSocket.instances).toHaveLength(0);
    stop();
  });
});
