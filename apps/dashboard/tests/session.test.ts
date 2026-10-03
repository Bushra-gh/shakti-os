import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase", () => ({
  accessToken: vi.fn().mockResolvedValue("live-session-jwt"),
}));

import { getMe } from "../lib/api";

describe("Supabase session boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("attaches the live session token to the operator identity request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "op-1", email: "operator@example.com", role: "operator", is_operator: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await getMe();
    const options = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer live-session-jwt");
  });
});
