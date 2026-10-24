import React from 'react';
import { act, screen } from '@testing-library/react-native';

import OnboardingKeywordsRoute from '@app/(onboarding)/tracking-keywords';
import TrackingKeywordsRoute from '@app/tracking/keywords';
import { renderWithProviders } from '@/test-utils/render';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { defaultKeywordRules } from '@/services/mocks/default-keywords';

afterEach(() => jest.restoreAllMocks());

it.each([
  ['onboarding', OnboardingKeywordsRoute],
  ['settings', TrackingKeywordsRoute]
])(
  'keeps the %s editor unavailable until the saved keyword list arrives',
  async (_name, Route) => {
    let finishLoad!: (
      rules: Awaited<
        ReturnType<typeof automaticTrackingService.listKeywordRules>
      >
    ) => void;
    jest.spyOn(automaticTrackingService, 'listKeywordRules').mockReturnValue(
      new Promise((resolve) => {
        finishLoad = resolve;
      })
    );
    renderWithProviders(<Route />);
    expect(screen.queryByLabelText('كلمة جديدة')).toBeNull();
    await act(async () => {
      finishLoad(
        defaultKeywordRules.map((rule) => ({
          ...rule,
          recentUseCount: 0,
          lastUsedAt: null
        }))
      );
    });
    expect(await screen.findByLabelText('كلمة جديدة')).toBeOnTheScreen();
  }
);
