import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { LegalScreen } from '@/features/legal/LegalScreen';

export default function LegalRoute() {
  const { document } = useLocalSearchParams<{ document?: string }>();
  return (
    <LegalScreen document={document === 'privacy' ? 'privacy' : 'terms'} />
  );
}
