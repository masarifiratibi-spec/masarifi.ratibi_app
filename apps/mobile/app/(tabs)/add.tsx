import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import type { TransactionType } from '@/domain/core-finance';
import { TransactionForm } from '@/features/transactions/TransactionForm';

const manualTypes: TransactionType[] = ['expense', 'income', 'transfer'];

export default function AddRoute() {
  const { type, accountId } = useLocalSearchParams<{
    type?: string;
    accountId?: string;
  }>();
  const initialType = manualTypes.includes(type as TransactionType)
    ? (type as TransactionType)
    : 'expense';

  return (
    <TransactionForm
      initialAccountId={accountId}
      initialType={initialType}
    />
  );
}
