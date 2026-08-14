import { deriveSavingsProgress } from './financial-planning';
import { fixtureGoal, fixtureMovement, planningToday } from '@/test-utils/financial-planning-fixtures';

it('derives savings progress from tracking-only movements', () => {
  expect(
    deriveSavingsProgress({
      goal: fixtureGoal,
      movements: [fixtureMovement],
      today: planningToday
    }).percentage
  ).toMatchObject({ status: 'available', value: 28 });
});
