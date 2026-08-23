import React from 'react';
import { Text } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import PlanningConflictRoute from '@app/modal/planning-conflict';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

let mockParams: { conflictId?: string } = {};
const mockPlanningConflictScreen = jest.fn(({ conflictId }: { conflictId?: string }) => (
  <Text>{conflictId ? `conflict ${conflictId}` : 'missing conflict'}</Text>
));

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn()
  },
  useLocalSearchParams: () => mockParams
}));

jest.mock('@/features/financial-planning/PlanningConflictScreen', () => ({
  PlanningConflictScreen: (props: { conflictId?: string }) =>
    mockPlanningConflictScreen(props)
}));

describe('PlanningConflictRoute', () => {
  beforeEach(() => {
    changeLocale('en');
    mockParams = { conflictId: 'conflict-budget-jan' };
    jest.clearAllMocks();
  });

  it('passes through a valid conflict id inside the route modal container', () => {
    const screen = renderWithProviders(<PlanningConflictRoute />);

    expect(screen.getByText(translate('planning.conflict.title'))).toBeTruthy();
    expect(screen.getByText('conflict conflict-budget-jan')).toBeTruthy();
    expect(mockPlanningConflictScreen).toHaveBeenCalledWith({
      conflictId: 'conflict-budget-jan'
    });
  });

  it('keeps missing conflict ids feature-owned and only dismisses on close', () => {
    mockParams = {};
    const screen = renderWithProviders(<PlanningConflictRoute />);

    expect(screen.getByText('missing conflict')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(translate('appShell.navigation.close')));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(mockPlanningConflictScreen).toHaveBeenCalledWith({
      conflictId: undefined
    });
  });
});
