import {
  frontendQualityScenarios,
  type FrontendQualityScenarioId
} from './frontend-quality-scenarios';

type PreservedState = {
  locale: string;
  securitySessionId: string;
  theme: string;
};

type ResetInput = {
  preservedState?: PreservedState;
  profileId: string;
  scenarioId: FrontendQualityScenarioId;
};

export class FrontendQualityScenarioResetError extends Error {
  constructor(readonly code: 'non_disposable_profile' | 'scenario_not_found' | 'profile_scenario_mismatch') {
    super(code);
  }
}

export async function resetFrontendQualityScenario({
  preservedState = { locale: 'ar', securitySessionId: 'session', theme: 'system' },
  profileId,
  scenarioId
}: ResetInput) {
  if (!profileId.startsWith('spec010-')) {
    throw new FrontendQualityScenarioResetError('non_disposable_profile');
  }

  const scenario = frontendQualityScenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new FrontendQualityScenarioResetError('scenario_not_found');
  }
  if (scenario.disposableProfileId !== profileId) {
    throw new FrontendQualityScenarioResetError('profile_scenario_mismatch');
  }

  return {
    clearedFixtureOwned: true,
    preservedState,
    profileId,
    scenarioId,
    seeded: {
      accounts: scenario.records.accounts.map((item) => item.id),
      expectedRoutes: [...scenario.expectedRoutes],
      expectedStates: [...scenario.expectedStates],
      notifications: scenario.records.notifications.map((item) => item.id),
      transactions: scenario.records.transactions.map((item) => item.id)
    }
  };
}
