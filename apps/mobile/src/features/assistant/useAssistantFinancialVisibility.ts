import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { usePreferenceStore } from '@/state/preferences';

/** Revealing one answer never changes global privacy or carries into another answer. */
export function useAssistantFinancialVisibility(key: string) {
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  useEffect(() => {
    setRevealedKey(null);
  }, [hideBalances]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setRevealedKey(null);
    });
    return () => listener.remove();
  }, []);
  return {
    hidden: hideBalances && revealedKey !== key,
    reveal: () => setRevealedKey(key)
  };
}
