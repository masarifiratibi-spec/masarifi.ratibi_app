import React from 'react';

export default function SettingsApplicationRoute() {
  const { ApplicationSettingsScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/ApplicationSettingsScreen') as typeof import('@/features/settings/ApplicationSettingsScreen');
  return <ApplicationSettingsScreen />;
}
