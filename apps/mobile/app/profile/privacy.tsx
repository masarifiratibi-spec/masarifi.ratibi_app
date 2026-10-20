import React from 'react';

export default function PrivacySettingsRoute() {
  const { PrivacySettingsScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/PrivacySettingsScreen') as typeof import('@/features/settings/PrivacySettingsScreen');
  return <PrivacySettingsScreen />;
}
