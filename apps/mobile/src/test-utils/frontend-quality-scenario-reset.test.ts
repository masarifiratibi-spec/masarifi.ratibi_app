import { resetFrontendQualityScenario } from './frontend-quality-scenario-reset';
import { frontendQualityScenarios } from './frontend-quality-scenarios';

describe('frontend quality scenario reset', () => {
  it('refuses normal profiles before deleting anything', async () => {
    await expect(
      resetFrontendQualityScenario({ profileId: 'real-user', scenarioId: 'typical' })
    ).rejects.toMatchObject({ code: 'non_disposable_profile' });
  });

  it('reseeds disposable profiles equivalently and preserves external state', async () => {
    const first = await resetFrontendQualityScenario({
      profileId: 'spec010-disposable',
      scenarioId: 'typical',
      preservedState: {
        locale: 'ar',
        theme: 'dark',
        securitySessionId: 'session-real'
      }
    });
    const second = await resetFrontendQualityScenario({
      profileId: 'spec010-disposable',
      scenarioId: 'typical',
      preservedState: first.preservedState
    });

    expect(first.seeded).toEqual(second.seeded);
    expect(second.preservedState).toEqual({
      locale: 'ar',
      theme: 'dark',
      securitySessionId: 'session-real'
    });
    expect(frontendQualityScenarios.some((item) => item.id === second.scenarioId)).toBe(true);
  });
});
