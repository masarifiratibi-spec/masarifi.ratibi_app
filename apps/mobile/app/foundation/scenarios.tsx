import React from 'react';

import {
  FrontendQualityScenarioScreen,
  FrontendQualityScenarioUnavailableScreen
} from '@/features/foundation/FrontendQualityScenarioScreen';

export default function FrontendQualityScenarioRoute() {
  return __DEV__
    ? <FrontendQualityScenarioScreen />
    : <FrontendQualityScenarioUnavailableScreen />;
}
