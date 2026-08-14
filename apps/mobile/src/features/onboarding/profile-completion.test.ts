import { deriveProfileCompletionSteps } from './profile-completion';

describe('profile completion', () => {
  it('derives six ordered steps from owning-feature summaries', () => {
    const steps = deriveProfileCompletionSteps({
      name: false,
      firstAccount: true,
      salary: false,
      budget: 'unavailable',
      obligation: false,
      savingsGoal: false
    });

    expect(steps.map((step) => step.id)).toEqual([
      'name',
      'first_account',
      'salary',
      'budget',
      'obligation',
      'savings_goal'
    ]);
    expect(steps).toContainEqual(expect.objectContaining({ id: 'first_account', status: 'completed' }));
    expect(steps).toContainEqual(expect.objectContaining({ id: 'budget', status: 'unavailable' }));
  });
});
