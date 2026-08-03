import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MaskedField } from "./MaskedField";
import { SessionExpired, isExpired } from "./SessionExpired";
import { sanitizeForLog } from "@/core/api/safe-log";
import { runLocked } from "@/features/foundation/useLockedMutation";
import { ConfirmDialog } from "./ui";

describe("frontend security boundaries", () => {
  test("never places a raw sensitive value in masking markup", () => {
    const html = renderToStaticMarkup(<MaskedField label="البريد" maskedValue="n***@example.test" />);
    expect(html).toContain("n***@example.test");
    expect(html).not.toContain("nora@example.test");
  });

  test("removes secrets, tokens, paths, raw errors, and private payloads from development logs", () => {
    expect(sanitizeForLog({
      token: "secret-token",
      password: "password",
      path: "C:\\private\\file",
      error: new Error("provider secret"),
      safeId: "DEMO-1",
    })).toEqual({
      token: "[REDACTED]",
      password: "[REDACTED]",
      path: "[REDACTED]",
      error: "[REDACTED]",
      safeId: "DEMO-1",
    });
  });

  test("detects session expiry and renders a safe replacement state", () => {
    expect(isExpired("2020-01-01T00:00:00+00:00", new Date("2026-07-27T00:00:00Z"))).toBe(true);
    const html = renderToStaticMarkup(<SessionExpired temporary unsavedChanges onReturn={() => undefined} />);
    expect(html).toContain("انتهت صلاحية الوصول المؤقت");
    expect(html).toContain("تغييرات غير محفوظة");
  });

  test("rejects duplicate sensitive mutations while one is pending", async () => {
    let resolveOperation: (() => void) | undefined;
    const first = runLocked("retry:IMP-1", () => new Promise<void>((resolve) => {
      resolveOperation = resolve;
    }));
    await expect(runLocked("retry:IMP-1", async () => undefined)).rejects.toMatchObject({ code: "conflict" });
    resolveOperation?.();
    await first;
  });

  test("confirmation contains scope, consequence, permission, and future audit metadata", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        auditEvent="admin.import.retry.requested"
        consequence="إعادة تشغيل المعالجة"
        onClose={() => undefined}
        onConfirm={() => undefined}
        open
        outcomes={{ success: "نجاح", failure: "فشل", conflict: "تعارض" }}
        pending={false}
        permission="imports.read"
        scope="IMP-1"
        title="تأكيد"
      />,
    );
    expect(html).toContain("IMP-1");
    expect(html).toContain("إعادة تشغيل المعالجة");
    expect(html).toContain("imports.read");
    expect(html).toContain("admin.import.retry.requested");
  });
});
