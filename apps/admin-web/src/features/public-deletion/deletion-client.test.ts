import { afterEach, describe, expect, it, vi } from "vitest";
import { deletionRequest, recentAuthHint } from "./deletion-client";
const id = "00000000-0000-4000-8000-000000000001";
afterEach(() => vi.unstubAllEnvs());
describe("public account deletion API", () => {
  it("preserves the operation across recent-auth verification and keeps tokens out of URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "RECENT_AUTH_REQUIRED" }), {
          status: 403,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id,
            status: "verified",
            coolingOffEndsAt: "2026-10-25T00:00:00.000Z",
          }),
        ),
      );
    const init = {
      method: "POST",
      headers: { "Idempotency-Key": id },
      body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
    };
    expect(
      await deletionRequest("me/deletion-requests", init, "old", fetcher),
    ).toEqual(recentAuthHint);
    expect(
      await deletionRequest("me/deletion-requests", init, "fresh", fetcher),
    ).toMatchObject({ id, status: "verified" });
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.example.com/api/v1/me/deletion-requests",
    );
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      body: init.body,
      headers: { Authorization: "Bearer fresh", "Idempotency-Key": id },
      cache: "no-store",
      credentials: "omit",
    });
  });
  it("uses the completion capability in a header and strips provider metadata", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id,
            status: "completed",
            completedAt: "2026-10-24T12:00:00.000Z",
            safeMetadata: { private: "no" },
          }),
        ),
      );
    expect(
      await deletionRequest(
        `privacy/deletion-completions/${id}`,
        {},
        "receipt",
        fetcher,
      ),
    ).toEqual({
      id,
      status: "completed",
      completedAt: "2026-10-24T12:00:00.000Z",
    });
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer receipt",
    );
  });
  it("does not treat an HTTP or invalid contract response as completion", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    await expect(
      deletionRequest(
        "me/deletion-requests",
        {},
        "token",
        vi
          .fn()
          .mockResolvedValue(
            new Response('{"status":"completed"}', { status: 503 }),
          ),
      ),
    ).rejects.toThrow("REQUEST_FAILED");
    await expect(
      deletionRequest(
        "me/deletion-requests",
        {},
        "token",
        vi
          .fn()
          .mockResolvedValue(
            new Response('{"id":"wrong","status":"completed"}'),
          ),
      ),
    ).rejects.toThrow();
  });
});
