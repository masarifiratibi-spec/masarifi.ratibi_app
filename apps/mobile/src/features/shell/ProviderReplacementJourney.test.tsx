import React from 'react';
import { Text } from 'react-native';
import { waitFor } from '@testing-library/react-native';

import { FinancialPositionPanel } from '@/features/foundation/FinancialPositionPanel';
import { renderWithProviders } from '@/test-utils/render';
import {
  createMockFinancialSummaryService,
  populatedSummary
} from '@/services/mocks/financial-summary';
import type { FinancialSummaryService } from '@/services/contracts/foundation-service';
import { buildPreferences } from '@/domain/foundation';
import { changeLocale } from '@/localization/i18n';

beforeEach(() => changeLocale('en'));

function Harness({ service }: { service: FinancialSummaryService }) {
  const [state, setState] = React.useState<'loading' | 'success' | 'unavailable' | 'error'>('loading');
  const [summary, setSummary] = React.useState<Awaited<ReturnType<FinancialSummaryService['getSummary']>> | null>(null);

  React.useEffect(() => {
    let alive = true;
    service
      .getSummary(buildPreferences({ locale: 'en', direction: 'ltr', hideBalances: false }))
      .then((value) => {
        if (!alive) return;
        setSummary(value);
        setState('success');
      })
      .catch((error) => {
        if (!alive) return;
        setState(error instanceof Error && error.message === 'unavailable' ? 'unavailable' : 'error');
      });
    return () => {
      alive = false;
    };
  }, [service]);

  if (state === 'loading') return <Text>foundation.provider.loading</Text>;
  if (state === 'unavailable') return <Text>foundation.provider.unavailable.manual</Text>;
  if (state === 'error') return <Text>foundation.provider.error.retry</Text>;
  return summary ? <FinancialPositionPanel summary={summary} /> : null;
}

describe('provider replacement journey', () => {
  it('shows the same success presentation for two conforming financial-summary providers', async () => {
    const first = createMockFinancialSummaryService(populatedSummary);
    const second = createMockFinancialSummaryService({ ...populatedSummary });

    const firstRender = renderWithProviders(<Harness service={first} />);
    await waitFor(() => expect(firstRender.getByText('Current balance')).toBeTruthy());

    const secondRender = renderWithProviders(<Harness service={second} />);
    await waitFor(() => expect(secondRender.getByText('Current balance')).toBeTruthy());
    expect(secondRender.getByText('Recent spending')).toBeTruthy();
    expect(secondRender.getByText('Next obligation')).toBeTruthy();
  });

  it('shows loading, unavailable, and actionable safe-error outcomes', async () => {
    const loading = renderWithProviders(
      <Harness service={{ getSummary: () => new Promise(() => undefined) }} />
    );
    expect(loading.getByText('foundation.provider.loading')).toBeTruthy();

    const unavailable = {
      getSummary: () => Promise.reject(new Error('unavailable'))
    };
    const failed = {
      getSummary: () => Promise.reject(new Error('raw provider stack'))
    };

    const unavailableRender = renderWithProviders(<Harness service={unavailable} />);
    await waitFor(() => expect(unavailableRender.getByText('foundation.provider.unavailable.manual')).toBeTruthy());

    const failedRender = renderWithProviders(<Harness service={failed} />);
    await waitFor(() => expect(failedRender.getByText('foundation.provider.error.retry')).toBeTruthy());
    expect(failedRender.queryByText(/raw provider stack/)).toBeNull();
  });
});
