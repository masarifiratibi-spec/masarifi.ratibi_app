import React from 'react';
import { router } from 'expo-router';
import { FinancialResetDialog } from '@/features/settings/FinancialResetDialog';
import { useAppShellStore } from '@/state/app-shell';

export default function FinancialResetRoute() {
  const session = useAppShellStore((state) => state.session);
  if (session?.status !== 'authenticated' || !session.userId) return null;
  return (
    <FinancialResetDialog
      key={session.userId}
      ownerId={session.userId}
      onClose={() =>
        router.canGoBack() ? router.back() : router.replace('/(tabs)/more')
      }
    />
  );
}
