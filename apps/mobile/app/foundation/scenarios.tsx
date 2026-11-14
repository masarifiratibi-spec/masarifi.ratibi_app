import React from 'react';

export default function FrontendQualityScenarioRoute() {
  // Route discovery must not construct the large disposable scenario fixtures.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const screens = require('@/features/foundation/FrontendQualityScenarioScreen') as typeof import('@/features/foundation/FrontendQualityScenarioScreen');
  return __DEV__
    ? <screens.FrontendQualityScenarioScreen />
    : <screens.FrontendQualityScenarioUnavailableScreen />;
}
