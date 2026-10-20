import React from 'react';

export default function NativeNotificationValidationRoute() {
  const { NativeNotificationValidationScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/notifications/NativeNotificationValidationScreen') as typeof import('@/features/notifications/NativeNotificationValidationScreen');
  return <NativeNotificationValidationScreen />;
}
