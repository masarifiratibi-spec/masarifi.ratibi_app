import React from 'react';

export default function NotificationsRoute() {
  const { NotificationCenterScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/notifications/NotificationCenterScreen') as typeof import('@/features/notifications/NotificationCenterScreen');
  return <NotificationCenterScreen />;
}
