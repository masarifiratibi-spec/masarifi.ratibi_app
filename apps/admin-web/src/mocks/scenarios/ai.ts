import { safeScenarioSchema, type SafeScenario } from "@/features/ai/contracts";

export function readAiScenario(request: Request): SafeScenario {
  const url = new URL(request.url);
  const candidate = request.headers.get("x-mock-scenario") ?? url.searchParams.get("__scenario");
  return safeScenarioSchema.safeParse(candidate).success ? candidate as SafeScenario : "success";
}
