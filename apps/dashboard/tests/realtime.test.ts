import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeWithReconnect } from "../lib/realtime";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen?: () => void;
  onclose?: () => void;
  onerror?: () => void;
  onmessage?: (message: { data: string }) => void;
  constructor() { FakeWebSocket.instances.push(this); }
  close() { this.onclose?.(); }
}

describe("realtime subscriptions", () => {
  afterEach(() => { FakeWebSocket.instances = []; vi.useRealTimers(); });

  it("connects, forwards messages, and reconnects after close", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const states: string[] = [];
    const messages: string[] = [];
    const stop = subscribeWithReconnect("ws://localhost/ws/events", (data) => messages.push(data), (state) => states.push(state));
    const first = FakeWebSocket.instances[0]!;
    first.onopen?.();
    first.onmessage?.({ data: "event.created" });
    first.onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(messages).toEqual(["event.created"]);
    expect(states).toContain("LIVE");
    expect(states).toContain("RECONNECTING");
    stop();
  });
});
