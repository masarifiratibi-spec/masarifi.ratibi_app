import type { ProfileCompletionStep } from '@/domain/app-shell';

export interface ProfileCompletionSummary {
  name: boolean | 'unavailable';
  firstAccount: boolean | 'unavailable';
  salary: boolean | 'unavailable';
  budget: boolean | 'unavailable';
  obligation: boolean | 'unavailable';
  savingsGoal: boolean | 'unavailable';
}

const stepDefinitions: {
  id: ProfileCompletionStep['id'];
  key: keyof ProfileCompletionSummary;
  destination: string;
}[] = [
  { id: 'name', key: 'name', destination: '/profile' },
  { id: 'first_account', key: 'firstAccount', destination: '/accounts' },
  { id: 'salary', key: 'salary', destination: '/salary' },
  { id: 'budget', key: 'budget', destination: '/budgets' },
  { id: 'obligation', key: 'obligation', destination: '/obligations' },
  { id: 'savings_goal', key: 'savingsGoal', destination: '/savings' }
];

export function deriveProfileCompletionSteps(
  summary: ProfileCompletionSummary
): ProfileCompletionStep[] {
  return stepDefinitions.map((step) => ({
    id: step.id,
    destination: step.destination,
    dismissed: false,
    status:
      summary[step.key] === 'unavailable'
        ? 'unavailable'
        : summary[step.key]
          ? 'completed'
          : 'incomplete'
  }));
}

export const emptyProfileSummary: ProfileCompletionSummary = {
  name: false,
  firstAccount: false,
  salary: false,
  budget: false,
  obligation: false,
  savingsGoal: false
};
