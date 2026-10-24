import React from 'react';
import { screen } from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import type { HomeSummary as Summary } from '@/domain/core-finance';
import { HomeSummary } from './HomeSummary';

const mockVoice = {
  session: { state: 'ready', durationMs: 0, errorCode: null },
  automatic: true,
  batches: { processing: false, uncertain: true, results: [], latest: null }
};
jest.mock('@/features/voice/useVoiceCapture', () => ({
  useVoiceCapture: () => mockVoice
}));

const summary: Summary = {
  totalBalanceMinor: 66000,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 0,
  periodExpenseMinor: 1000,
  activeAccountCount: 1,
  recentTransactions: [],
  reviewCount: 0,
  pendingSyncCount: 0,
  dataState: 'ready'
};

it.each([
  ['ar', false],
  ['en', false],
  ['ar', true],
  ['en', true]
] as const)(
  'shows actual new analysis, rather than old recovery, in %s with current processing %s',
  (locale, processing) => {
    changeLocale(locale);
    mockVoice.batches.processing = processing;
    renderWithProviders(<HomeSummary summary={summary} />);
    if (processing)
      expect(screen.getByTestId('home-voice-processing-inline')).toBeTruthy();
    else
      expect(screen.queryByTestId('home-voice-processing-inline')).toBeNull();
  }
);
