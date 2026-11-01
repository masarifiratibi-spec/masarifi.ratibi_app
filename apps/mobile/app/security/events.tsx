import React from 'react';

export default function SecurityEventsRoute() {
  const { SecurityEventScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/SecurityEventScreen') as typeof import('@/features/settings/SecurityEventScreen');
  return <SecurityEventScreen />;
}
