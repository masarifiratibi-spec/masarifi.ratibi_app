type Gate = {
  owner: () => string | null;
  check: (owner: string) => Promise<string>;
};
let gate: Gate | undefined;
export function bindGenerationGate(next: Gate) {
  gate = next;
  return () => {
    if (gate === next) gate = undefined;
  };
}
export async function captureWriteGeneration() {
  const active = gate;
  if (!active) return undefined;
  const owner = active.owner();
  if (!owner) throw Error('financial write requires an authenticated owner');
  const value = await active.check(owner);
  if (active !== gate || active.owner() !== owner)
    throw Error('financial write owner changed');
  return {
    owner,
    value,
    current: () => active === gate && active.owner() === owner
  };
}
export function generationHeaders(
  binding: Awaited<ReturnType<typeof captureWriteGeneration>>
): Record<string, string> {
  if (!binding) return {};
  if (!binding.current()) throw Error('financial write owner changed');
  return { 'X-Financial-Generation': binding.value };
}

export function financialMutation(path: string, method = 'GET') {
  return (
    !/^(GET|HEAD|OPTIONS)$/i.test(method) &&
    /^\/api\/v1\/(accounts|transactions|categories|transfers|budgets|obligations|salary-profiles|savings-goals|payment-matches|planning|reports|report-schedules|assistant|tracking|imports|reviews|duplicates|feedback|sync|voice)(?:\/|\?|$)/.test(
      path
    )
  );
}
