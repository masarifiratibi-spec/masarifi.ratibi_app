import React from 'react';

export default function SupportHomeRoute() {
  const { SupportHomeScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/support/SupportHomeScreen') as typeof import('@/features/support/SupportHomeScreen');
  return <SupportHomeScreen />;
}
