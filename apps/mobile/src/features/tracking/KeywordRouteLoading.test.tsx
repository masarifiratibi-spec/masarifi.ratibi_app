import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';

import OnboardingKeywordsRoute from '@app/(onboarding)/tracking-keywords';
import TrackingKeywordsRoute from '@app/tracking/keywords';
import { renderWithProviders } from '@/test-utils/render';
import { automaticTrackingKeys } from '@/state/automatic-tracking-view-state';
import { QueryClient } from '@tanstack/react-query';
import { FoundationProviders } from '@/state/FoundationProviders';
import { translate } from '@/localization/i18n';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { defaultKeywordRules } from '@/services/mocks/default-keywords';

afterEach(() => jest.restoreAllMocks());

it.each([
  ['settings', TrackingKeywordsRoute, 'tracking.action.save'],
  ['onboarding', OnboardingKeywordsRoute, 'appShell.onboarding.continue']
])(
  'shows saved %s keyword rules through a failed refresh without enabling a configuration save',
  async (_name, Route, primary) => {
    jest
      .spyOn(automaticTrackingService, 'listKeywordRules')
      .mockRejectedValue(Error('offline'));
    const saved = defaultKeywordRules.map((rule) => ({
      ...rule,
      recentUseCount: 0,
      lastUsedAt: null
    }));
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0, gcTime: Infinity }
      }
    });
    client.setQueryData(automaticTrackingKeys.keywords(), saved, {
      updatedAt: 100
    });
    const view = render(
      <FoundationProviders client={client}>
        <Route />
      </FoundationProviders>
    );
    expect(screen.getByLabelText('كلمة جديدة')).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        screen.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
      ).toBeOnTheScreen()
    );
    expect(
      screen.getByRole('button', { name: translate(primary as never) })
    ).toBeDisabled();
    view.unmount();
    client.clear();
  }
);

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
