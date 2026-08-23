import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import type { AccountType } from '@/domain/core-finance';
import { AccountForm } from '@/features/accounts/AccountForm';
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

  return (
    <AccountForm
      initialType={selectedType}
      onBack={() => setSelectedType(null)}
    />
  );
}
