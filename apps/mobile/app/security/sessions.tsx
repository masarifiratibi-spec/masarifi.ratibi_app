import React from 'react';

export default function SecuritySessionsRoute() {
  const { SessionListScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/SessionListScreen') as typeof import('@/features/settings/SessionListScreen');
  return <SessionListScreen />;
}
