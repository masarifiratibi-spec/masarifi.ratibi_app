import React from 'react';

export default function ProfileSetupRoute() {
  // Route discovery must not initialize a screen the current owner won't visit.
  const { ProfileSetupScreen } =
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    require('@/features/onboarding/ProfileSetupScreen') as typeof import('@/features/onboarding/ProfileSetupScreen');
  return <ProfileSetupScreen />;
}
