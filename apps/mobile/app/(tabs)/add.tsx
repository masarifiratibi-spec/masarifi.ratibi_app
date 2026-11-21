import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import type { TransactionType } from '@/domain/core-finance';

const manualTypes: TransactionType[] = ['expense', 'income', 'transfer'];

export default function AddRoute() {
  const { type, accountId, originalTransactionId } = useLocalSearchParams<{
    type?: string;
    accountId?: string;
    originalTransactionId?: string;
  }>();
  const initialType =
    type === 'refund' && originalTransactionId
      ? 'refund'
      : manualTypes.includes(type as TransactionType)
        ? (type as TransactionType)
        : 'expense';

  const { TransactionForm } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/transactions/TransactionForm') as typeof import('@/features/transactions/TransactionForm');

  return (
    <TransactionForm
      initialAccountId={accountId}
      initialType={initialType}
      originalTransactionId={originalTransactionId}
    />
  );
}
