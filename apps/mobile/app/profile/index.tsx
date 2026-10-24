import React from 'react';

export default function ProfileRoute() {
  const { ProfileScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/ProfileScreen') as typeof import('@/features/settings/ProfileScreen');
  return <ProfileScreen />;
}
