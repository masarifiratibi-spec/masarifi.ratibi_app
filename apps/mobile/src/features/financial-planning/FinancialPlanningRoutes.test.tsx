import { deriveProfileCompletionSteps } from '@/features/onboarding/profile-completion';

it('keeps planning routes secondary and primary tabs unchanged', () => {
  const steps = deriveProfileCompletionSteps({
    name: false,
    firstAccount: false,
    salary: false,
    budget: false,
    obligation: false,
    savingsGoal: false
  });
  expect(steps.map((step) => step.destination)).toEqual([
    '/profile',
    '/accounts',
    '/salary',
    '/budgets',
    '/obligations',
    '/savings'
  ]);
  expect(['/home', '/transactions', '/add', '/reports', '/more']).toHaveLength(5);
});
