export type DeploymentEnvironment =
  "production" | "staging" | "development" | "unknown";

export function resolveDeploymentEnvironment(
  configured?: string,
  hostname?: string,
): DeploymentEnvironment {
  if (
    configured === "production" ||
    configured === "staging" ||
    configured === "development"
  )
    return configured;
  const host = hostname?.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]")
    return "development";
  if (host === "staging.masarifiratibi.com") return "staging";
  if (host === "masarifiratibi.com" || host === "www.masarifiratibi.com")
    return "production";
  return "unknown";
}
