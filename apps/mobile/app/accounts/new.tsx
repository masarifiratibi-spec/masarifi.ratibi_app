import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import type { AccountType } from '@/domain/core-finance';
import { AccountTypeSelectionScreen } from '@/features/accounts/AccountTypeSelectionScreen';

export default function NewAccountRoute() {
  const params = useLocalSearchParams<{ type?: AccountType }>();
  const [selectedType, setSelectedType] = useState<AccountType | null>(
    params.type ?? null
  );

  if (!selectedType) {
    return (
      <AccountTypeSelectionScreen
        onSelectType={(type) => setSelectedType(type)}
        onClose={() => router.back()}
      />
    );
  }

  const { AccountForm } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/accounts/AccountForm') as typeof import('@/features/accounts/AccountForm');
  return (
    <AccountForm
      initialType={selectedType}
      onBack={() => setSelectedType(null)}
    />
  );
}
