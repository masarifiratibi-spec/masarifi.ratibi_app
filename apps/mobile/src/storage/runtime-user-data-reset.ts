const resets = new Set<() => void>();

export function registerRuntimeUserDataReset(reset: () => void): () => void {
  resets.add(reset);
  return () => resets.delete(reset);
}

export function resetRuntimeUserData(): void {
  for (const reset of resets) reset();
}
