import { http, HttpResponse } from "msw";
import { z } from "zod";
import { describe, expect, test } from "vitest";
import { mockServer } from "@/mocks/server";
import { requestJson } from "./client";
import { ApiError, normalizeApiError, normalizeHttpStatus, safeApiMessage, type ApiErrorCode } from "./errors";
import { normalizePagination } from "./pagination";
import { localeSchema, searchTextSchema } from "@/core/validation/common";

describe("safe core boundaries", () => {
  test("normalizes raw failures without exposing their message", () => {
    const result = normalizeApiError(new Error("secret token abc"));

    expect(result.code).toBe("internal_error");
    expect(result.message).toBe("تعذر إكمال الطلب. حاول مرة أخرى.");
    expect(result.message).not.toContain("secret");
  });

  test("preserves already-safe API errors", () => {
    const error = new ApiError("forbidden", "غير مصرح بهذا الإجراء.", 403);
    expect(normalizeApiError(error)).toBe(error);
  });

  test("normalizes page bounds and caps page size", () => {
    expect(normalizePagination({ page: -2, pageSize: 500 })).toEqual({ page: 1, pageSize: 100 });
  });

  test("rejects unsupported locales and oversized searches", () => {
    expect(localeSchema.safeParse("fr").success).toBe(false);
    expect(searchTextSchema.safeParse("x".repeat(101)).success).toBe(false);
  });

  test("maps HTTP statuses to safe allowlisted codes", () => {
    expect(normalizeHttpStatus(400)).toBe("validation_error");
    expect(normalizeHttpStatus(401)).toBe("session_expired");
    expect(normalizeHttpStatus(403)).toBe("forbidden");
    expect(normalizeHttpStatus(404)).toBe("not_found");
    expect(normalizeHttpStatus(409)).toBe("conflict");
    expect(normalizeHttpStatus(410)).toBe("gone");
    expect(normalizeHttpStatus(422)).toBe("validation_error");
    expect(normalizeHttpStatus(429)).toBe("rate_limited");
    expect(normalizeHttpStatus(500)).toBe("internal_error");
    expect(normalizeHttpStatus(503)).toBe("provider_unavailable");
  });

  test("safe messages for all phase 2 codes are bounded and payload-free", () => {
    const codes: ApiErrorCode[] = [
      "validation_error",
      "forbidden",
      "not_found",
      "conflict",
      "session_expired",
      "gone",
      "rate_limited",
      "provider_unavailable",
      "internal_error",
    ];
    for (const code of codes) {
      const message = safeApiMessage(code);
      expect(message.length).toBeGreaterThan(0);
      expect(message.length).toBeLessThanOrEqual(240);
      expect(message).not.toContain("token");
      expect(message).not.toContain("stack");
    }
  });

  test.each([
    [401, "session_expired"],
    [404, "not_found"],
    [410, "gone"],
    [422, "validation_error"],
    [429, "rate_limited"],
  ] as const)("rejects HTTP %i without exposing its raw payload", async (status, expectedCode) => {
    mockServer.use(
      http.get("/api/v1/admin/unsafe-error", () =>
        HttpResponse.json(
          { code: expectedCode, message: "secret token and private stack trace" },
          { status },
        ),
      ),
    );

    await expect(requestJson("/api/v1/admin/unsafe-error", z.object({}))).rejects.toMatchObject({
      code: expectedCode,
      status,
    });

    try {
      await requestJson("/api/v1/admin/unsafe-error", z.object({}));
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).not.toMatch(/secret|token|stack/i);
    }
  });

  test.each([
    ["super-admin", true],
    ["import-operator", true],
    ["support-agent", true],
    ["invalid-role", false],
    ["", false],
  ] as const)("sends valid development roles and omits invalid ones", async (role, shouldIncludeHeader) => {
    mockServer.use(
      http.get("/api/v1/test-role-header", ({ request }) => {
        const header = request.headers.get("x-admin-simulated-role");
        return HttpResponse.json({ hasRoleHeader: header !== null, role: header });
      }),
    );

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("admin-simulated-role", role);
    }

    const result = await requestJson("/api/v1/test-role-header", z.object({ hasRoleHeader: z.boolean(), role: z.string().nullable() }));

    expect(result.hasRoleHeader).toBe(shouldIncludeHeader);
    if (shouldIncludeHeader) {
      expect(result.role).toBe(role);
    } else {
      expect(result.role).toBeNull();
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("admin-simulated-role");
    }
  });
});
