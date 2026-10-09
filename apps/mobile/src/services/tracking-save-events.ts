const listeners = new Set<() => void>();
export function subscribeTrackingSaves(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function publishTrackingSave(): void {
  listeners.forEach((listener) => listener());
}
