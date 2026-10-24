import React from 'react';

export default function ProfilePhoneRoute() {
  const { ProfilePhoneScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/ProfilePhoneScreen') as typeof import('@/features/settings/ProfilePhoneScreen');
  return <ProfilePhoneScreen />;
}
