import { expect, test } from "vitest";
import { resolveDeploymentEnvironment } from "./deployment-environment";

test("reports the actual host environment independently of fixture or live mode", () => {
  expect(
    resolveDeploymentEnvironment(undefined, "staging.masarifiratibi.com"),
  ).toBe("staging");
  expect(resolveDeploymentEnvironment(undefined, "masarifiratibi.com")).toBe(
    "production",
  );
  expect(resolveDeploymentEnvironment(undefined, "localhost")).toBe(
    "development",
  );
  expect(resolveDeploymentEnvironment(undefined, "127.0.0.1")).toBe(
    "development",
  );
  expect(resolveDeploymentEnvironment("staging", "preview.example.test")).toBe(
    "staging",
  );
  expect(resolveDeploymentEnvironment(undefined, "preview.example.test")).toBe(
    "unknown",
  );
});
