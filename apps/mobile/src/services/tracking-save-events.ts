export interface TrackingSaveEvent {
  ownerId: string;
  transactionIds: readonly string[];
}
const listeners = new Set<(event: TrackingSaveEvent) => void>();
export function subscribeTrackingSaves(
  listener: (event: TrackingSaveEvent) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function publishTrackingSave(event: TrackingSaveEvent): void {
  listeners.forEach((listener) => listener(event));
}
