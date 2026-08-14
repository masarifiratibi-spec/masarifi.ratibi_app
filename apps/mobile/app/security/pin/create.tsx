import React, { useState } from 'react';
import { router } from 'expo-router';

import { PinForm } from '@/features/security/PinForm';

let pendingPin: string | null = null;

export function getPendingPinForTest() {
  return pendingPin;
}

export function clearPendingPin() {
  pendingPin = null;
}

export default function CreatePinRoute() {
  const [loading, setLoading] = useState(false);
  return (
    <PinForm
      loading={loading}
      mode="create"
      onSubmit={(pin) => {
        setLoading(true);
        pendingPin = pin;
        router.push('/security/pin/confirm');
      }}
    />
  );
}
