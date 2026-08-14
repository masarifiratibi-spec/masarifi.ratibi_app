import React from 'react';
import { router } from 'expo-router';

import { AccountPicker } from '@/features/transactions/AccountPicker';

export default function AccountPickerRoute() {
  return <AccountPicker onSelect={() => router.back()} />;
}
