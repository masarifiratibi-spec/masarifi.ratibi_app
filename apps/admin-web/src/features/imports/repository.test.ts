import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { resetPhase4State } from "@/mocks/phase4-import-state";
import { mockServer } from "@/mocks/server";
import { phase4OverviewFixtures } from "@/mocks/fixtures/imports";
import { importsRepository, phase4Repository } from "./repository";

describe("imports repository", () => {
  beforeEach(() => {
    resetPhase4State();
    window.sessionStorage.clear();
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true";
  });

  afterEach(() => {
    window.sessionStorage.clear();
    delete process.env.NEXT_PUBLIC_ENABLE_MOCKS;
  });

  test("returns sanitized paginated records matching source filters", async () => {
    const result = await importsRepository.getImports({ page: 1, pageSize: 25, platform: "android" });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.platform === "Android")).toBe(true);
    expect(result.items.every((item) => !/\b\d{10,}\b/.test(item.sanitizedResult))).toBe(true);
  });

  test("supports empty and conflict scenarios", async () => {
    await expect(importsRepository.getImports({ page: 1, pageSize: 25, scenario: "empty" }))
      .resolves.toMatchObject({ items: [], totalItems: 0 });
    await expect(importsRepository.retryImport("IMP-77241", "conflict"))
      .rejects.toMatchObject({ code: "conflict", status: 409 });
  });

  test("denies the legacy imports overview when the simulated role cannot read imports", async () => {
    window.sessionStorage.setItem("admin-simulated-role", "billing-operator");

    await expect(
      importsRepository.getImports({ page: 1, pageSize: 25 }),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  test("rejects a direct retry without confirmation and expected state", async () => {
    const response = await fetch("/api/v1/admin/imports/IMP-77241/retry", {
      method: "POST",
      headers: { "x-admin-simulated-role": "import-operator" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "validation_error" });
  });
});

describe("Spec 005 repository boundaries", () => {
  beforeEach(() => {
    resetPhase4State();
    window.sessionStorage.clear();
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true";
  });

  afterEach(() => {
    window.sessionStorage.clear();
    delete process.env.NEXT_PUBLIC_ENABLE_MOCKS;
  });

  test("returns authoritative combined, Android, and iOS overviews", async () => {
    const [combined, android, ios] = await Promise.all([
      phase4Repository.getOverview("all"),
      phase4Repository.getOverview("android"),
      phase4Repository.getOverview("ios"),
    ]);

    expect(combined.uniqueCustomers).not.toBe(android.uniqueCustomers + ios.uniqueCustomers);
    expect(combined.uniqueCustomerSemantics).toBe("authoritative");
    expect(android.platform).toBe("android");
    expect(ios.platform).toBe("ios");
  });

  test.each([
    ["import-operator", "import-operator"],
    ["invalid-role", null],
  ])("sends only allowlisted development role %s", async (storedRole, expectedHeader) => {
    let receivedRole: string | null = "not-observed";
    mockServer.use(http.get("/api/v1/admin/imports/overview", ({ request }) => {
      receivedRole = request.headers.get("x-admin-simulated-role");
      return HttpResponse.json(phase4OverviewFixtures.all);
    }));
    window.sessionStorage.setItem("admin-simulated-role", storedRole);

    await phase4Repository.getOverview("all");

    expect(receivedRole).toBe(expectedHeader);
  });

  test("serializes validated filters and returns bounded session pages", async () => {
    const response = await phase4Repository.list("sessions", {
      platform: "android",
      source: "android_sms",
      parserVersionId: "PV-3182",
      appVersion: "4.8.1",
      dateFrom: "2026-07-29",
      dateTo: "2026-07-29",
      sort: "appVersion",
      order: "asc",
      page: 1,
      pageSize: 25,
    });

    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      id: "IMP-77241",
      platform: "android",
      source: "android_sms",
    });
    expect(response.totalPages).toBe(1);
  });

  test("supports large pages and filtered pagination without leaking fixtures", async () => {
    const firstPage = await phase4Repository.list("sessions", {
      scenario: "large",
      page: 1,
      pageSize: 50,
      sort: "id",
      order: "asc",
    });
    const secondPage = await phase4Repository.list("sessions", {
      scenario: "large",
      page: 2,
      pageSize: 50,
      sort: "id",
      order: "asc",
    });

    expect(firstPage.items).toHaveLength(50);
    expect(secondPage.items).toHaveLength(50);
    expect(firstPage.items[0].id).not.toBe(secondPage.items[0].id);
  });

  test("rejects unsafe response scenarios at the production schema boundary", async () => {
    await expect(phase4Repository.list("sessions", {
      page: 1,
      pageSize: 25,
      scenario: "unsafe-response",
    })).rejects.toMatchObject({ code: "validation_error" });
  });

  test("receives structurally reduced records for limited support access", async () => {
    window.sessionStorage.setItem("admin-simulated-role", "support-agent");
    const response = await phase4Repository.list("sessions", { page: 1, pageSize: 25 });

    expect(response.items[0].accessLevel).toBe("limited");
    expect(response.items[0].preview).toBeUndefined();
    expect(response.items[0].definition).toBeUndefined();
    expect(response.items[0].actions).toEqual([]);
  });

  test("encodes and validates session detail identifiers", async () => {
    await expect(phase4Repository.getDetail("sessions", "IMP-77241"))
      .resolves.toMatchObject({ id: "IMP-77241", expectedCurrentState: "failed" });
    expect(() => phase4Repository.getDetail("sessions", "../unsafe")).toThrow();
  });

  test("locks actions behind confirmation and expected revision", async () => {
    await expect(phase4Repository.act("sessions", "IMP-77241", {
      action: "retry_handoff",
      expectedState: "failed",
      expectedRevision: 1,
      reason: "إعادة محاولة تشغيلية",
      confirmationToken: "CONFIRM-SPEC-005",
    })).resolves.toMatchObject({
      affectedId: "IMP-77241",
      previousState: "failed",
      currentState: "processing",
      outcome: "success",
    });

    await expect(phase4Repository.act("sessions", "IMP-77241", {
      action: "retry_handoff",
      expectedState: "failed",
      expectedRevision: 1,
      reason: "إرسال مكرر",
      confirmationToken: "CONFIRM-SPEC-005",
    })).rejects.toMatchObject({ code: "conflict" });
  });

  test("enforces version tests, active-scope uniqueness, and rollback lineage", async () => {
    await expect(phase4Repository.act("versions", "PV-3183", {
      action: "release",
      expectedState: "draft",
      expectedRevision: 1,
      reason: "إصدار غير مؤهل",
      confirmationToken: "CONFIRM-SPEC-005",
    })).rejects.toMatchObject({ code: "conflict" });

    await phase4Repository.act("versions", "PV-3182", {
      action: "retire",
      expectedState: "active",
      expectedRevision: 1,
      reason: "إحالة الإصدار النشط للتقاعد",
      confirmationToken: "CONFIRM-SPEC-005",
    });
    await phase4Repository.act("versions", "PV-3183", {
      action: "test",
      expectedState: "draft",
      expectedRevision: 1,
      reason: "تشغيل الاختبارات المطلوبة",
      confirmationToken: "CONFIRM-SPEC-005",
    });
    await expect(phase4Repository.act("versions", "PV-3183", {
      action: "release",
      expectedState: "testing",
      expectedRevision: 2,
      reason: "الإصدار بعد نجاح الاختبارات",
      confirmationToken: "CONFIRM-SPEC-005",
    })).resolves.toMatchObject({ currentState: "active" });
    await expect(phase4Repository.act("versions", "PV-3182", {
      action: "rollback",
      expectedState: "retired",
      expectedRevision: 2,
      reason: "إنشاء مسودة تراجع",
      confirmationToken: "CONFIRM-SPEC-005",
    })).resolves.toMatchObject({ createdDraftId: "PV-RB-001" });
  });

  test("rejects overlapping sender and category patterns through handlers", async () => {
    await expect(phase4Repository.act("senders", "SND-001", {
      action: "save",
      expectedState: "active",
      expectedRevision: 1,
      reason: "اختبار تعارض نمط مرسل",
      confirmationToken: "CONFIRM-SPEC-005",
      proposal: { pattern: "^ALT-DEMO$" },
    })).rejects.toMatchObject({ code: "conflict" });

    await expect(phase4Repository.act("category-rules", "CR-001", {
      action: "save",
      expectedState: "active",
      expectedRevision: 1,
      reason: "اختبار تعارض نمط تصنيف",
      confirmationToken: "CONFIRM-SPEC-005",
      proposal: { pattern: "demo-transport" },
    })).rejects.toMatchObject({ code: "conflict" });
  });
});
