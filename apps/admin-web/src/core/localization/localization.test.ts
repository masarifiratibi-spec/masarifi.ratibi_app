import { describe, expect, it } from "vitest";
import { getActionLabel, getNavigationLabel, getRoleLabel, getSeverityLabel, getStatusLabel } from "./display-labels";
import { messages, t } from "./messages";

function flattenKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? flattenKeys(child as Record<string, unknown>, next)
      : [next];
  });
}

function tokens(value: string): string[] {
  return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

describe("localization messages", () => {
  it("keeps Arabic and English dictionaries structurally identical", () => {
    expect(flattenKeys(messages.ar)).toEqual(flattenKeys(messages.en));
  });

  it("keeps interpolation tokens aligned between locales", () => {
    for (const key of flattenKeys(messages.en)) {
      const en = t("en", key);
      const ar = t("ar", key);
      expect(tokens(ar), key).toEqual(tokens(en));
    }
  });

  it("interpolates localized messages", () => {
    expect(t("en", "shell.profilePhoto", { name: "Waleed" })).toBe("Waleed profile photo");
    expect(t("ar", "shell.profilePhoto", { name: "Waleed" })).toBe("صورة Waleed");
  });
});

describe("localized display labels", () => {
  it("localizes common admin labels without changing source values", () => {
    expect(getStatusLabel("en", "active")).toBe("Active");
    expect(getStatusLabel("ar", "active")).toBe("نشط");
    expect(getRoleLabel("en", "support-agent")).toBe("Support Agent");
    expect(getRoleLabel("ar", "support-agent")).toBe("وكيل الدعم");
    expect(getSeverityLabel("ar", "critical")).toBe("حرج");
    expect(getActionLabel("en", "security.incident.updated")).toBe("Security incident updated");
  });

  it("localizes navigation labels from stable ids", () => {
    expect(getNavigationLabel("en", "admin-team", "Admin Team")).toBe("Admin Team");
    expect(getNavigationLabel("ar", "admin-team", "Admin Team")).toBe("فريق الإدارة");
    expect(getNavigationLabel("ar", "communications", "Communications")).toBe("التواصل والمحتوى");
  });
});
