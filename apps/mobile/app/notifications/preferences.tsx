import React from 'react';

export default function NotificationPreferencesRoute() {
  const { NotificationPreferencesScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/notifications/NotificationPreferencesScreen') as typeof import('@/features/notifications/NotificationPreferencesScreen');
  return <NotificationPreferencesScreen />;
}
