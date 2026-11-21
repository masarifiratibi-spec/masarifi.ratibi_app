import { create } from 'zustand';

// UI-only coordination; no account, recording or financial data is persisted.
export const useVoiceUpdateInteraction = create<{ pending: number }>(() => ({
  pending: 0
}));

export function beginVoiceUpdateInteraction(): () => void {
  useVoiceUpdateInteraction.setState((state) => ({
    pending: state.pending + 1
  }));
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    useVoiceUpdateInteraction.setState((state) => ({
      pending: Math.max(0, state.pending - 1)
    }));
  };
}
