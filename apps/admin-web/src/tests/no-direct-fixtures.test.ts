import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, test } from "vitest";

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) && !path.includes(".test.") ? [path] : [];
  });
}

describe("presentation data boundaries", () => {
  test("pages and presentation components never import raw admin fixtures", () => {
    const roots = [
      join(process.cwd(), "src", "app"),
      join(process.cwd(), "src", "components"),
      join(process.cwd(), "src", "features", "access"),
      join(process.cwd(), "src", "features", "ai"),
      join(process.cwd(), "src", "features", "billing"),
      join(process.cwd(), "src", "features", "imports"),
      join(process.cwd(), "src", "features", "security"),
      join(process.cwd(), "src", "features", "system-health"),
      join(process.cwd(), "src", "features", "governance"),
    ];
    const violations = roots.flatMap(sourceFiles).filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("@/data") || source.includes("data/admin") || source.includes("@/mocks/fixtures");
    });

    expect(violations).toEqual([]);
  });

  test("AI routes and presentation files stay behind repositories", () => {
    const appAiRoot = join(process.cwd(), "src", "app", "admin", "ai");
    const featureAiRoot = join(process.cwd(), "src", "features", "ai");
    expect(existsSync(appAiRoot)).toBe(true);
    expect(existsSync(featureAiRoot)).toBe(true);

    const violations = [appAiRoot, featureAiRoot].flatMap(sourceFiles).filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("@/mocks/fixtures");
    });

    expect(violations).toEqual([]);
  });

  test("Phase 7 routes and presentation files stay behind repositories", () => {
    const appSecurityRoots = [
      join(process.cwd(), "src", "app", "admin", "security"),
      join(process.cwd(), "src", "app", "admin", "audit"),
      join(process.cwd(), "src", "app", "admin", "data-requests"),
    ];
    const featureSecurityRoot = join(process.cwd(), "src", "features", "security");

    const violations = [...appSecurityRoots, featureSecurityRoot].flatMap(sourceFiles).filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("@/mocks/fixtures");
    });

    expect(violations).toEqual([]);
  });

  test("Phase 8 routes and presentation files stay behind repositories", () => {
    const roots = [
      join(process.cwd(), "src", "app", "admin", "system-health"),
      join(process.cwd(), "src", "app", "admin", "jobs"),
      join(process.cwd(), "src", "features", "system-health"),
    ];

    const violations = roots.flatMap(sourceFiles).filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("@/mocks/fixtures") || source.includes("phase8-system-health-state");
    });

    expect(violations).toEqual([]);
  });

  test("Phase 9 routes and presentation files stay behind repositories", () => {
    const roots = [
      join(process.cwd(), "src", "app", "admin", "admin-team"),
      join(process.cwd(), "src", "app", "admin", "roles"),
      join(process.cwd(), "src", "app", "admin", "settings"),
      join(process.cwd(), "src", "features", "governance"),
    ];

    const violations = roots.flatMap(sourceFiles).filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("@/mocks/fixtures") || source.includes("phase9-governance-state");
    });

    expect(violations).toEqual([]);
  });
});
