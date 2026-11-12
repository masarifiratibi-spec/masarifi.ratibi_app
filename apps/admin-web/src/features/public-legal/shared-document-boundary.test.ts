import { readFileSync, existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { expect, test } from "vitest";
import nextConfig from "../../../next.config";

test("keeps every shared legal document inside the bundler and deployment trace roots", () => {
  const featureRoot = resolve(process.cwd(), "src/features/public-legal");
  const appRoot = resolve(featureRoot, "../../..");
  const source = readFileSync(
    resolve(featureRoot, "PublicLegalPage.tsx"),
    "utf8",
  );
  const sharedImports = [...source.matchAll(/from\s+"([^"]+\.json)"/g)];
  expect(sharedImports).toHaveLength(4);
  const roots = [
    nextConfig.turbopack?.root ?? appRoot,
    nextConfig.outputFileTracingRoot ?? appRoot,
  ];
  for (const match of sharedImports) {
    const document = resolve(featureRoot, match[1]);
    expect(existsSync(document)).toBe(true);
    for (const root of roots) {
      const withinRoot = relative(root, document);
      expect({
        document,
        root,
        inside:
          !isAbsolute(withinRoot) &&
          withinRoot !== ".." &&
          !withinRoot.startsWith("../") &&
          !withinRoot.startsWith("..\\"),
      }).toMatchObject({ inside: true });
    }
  }
});
