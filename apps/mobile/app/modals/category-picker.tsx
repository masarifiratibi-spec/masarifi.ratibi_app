import React from 'react';
import { router } from 'expo-router';

import { CategoryPicker } from '@/features/transactions/CategoryPicker';

export default function CategoryPickerRoute() {
  return <CategoryPicker onSelect={() => router.back()} />;
}
