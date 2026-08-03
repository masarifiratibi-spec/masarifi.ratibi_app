export const FOUNDATION_SCENARIOS = [
  "success",
  "loading",
  "slow",
  "large",
  "empty",
  "partial",
  "unauthorized",
  "forbidden",
  "not-found",
  "gone",
  "conflict",
  "rate-limited",
  "unavailable",
  "unsafe-response",
  "internal-error",
  "validation",
  "expired",
  "duplicate-pending",
] as const;

export type FoundationScenario = (typeof FOUNDATION_SCENARIOS)[number];

export function readScenario(request: Request): FoundationScenario {
  const url = new URL(request.url);
  const candidate = request.headers.get("x-mock-scenario") ?? url.searchParams.get("__scenario");
  return FOUNDATION_SCENARIOS.includes(candidate as FoundationScenario)
    ? candidate as FoundationScenario
    : "success";
}
