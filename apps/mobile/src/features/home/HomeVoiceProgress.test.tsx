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
  ['ar', 'ready', false],
  ['en', 'ready', false],
  ['ar', 'ready', true],
  ['en', 'ready', true],
  ['ar', 'preparing', false],
  ['en', 'preparing', false],
  ['ar', 'requesting_permission', false],
  ['en', 'requesting_permission', false],
  ['ar', 'uploading', false],
  ['en', 'uploading', false]
] as const)(
  'keeps automatic Voice quiet in %s during %s with batch processing %s',
  (locale, state, processing) => {
    changeLocale(locale);
    mockVoice.session.state = state;
    mockVoice.batches.processing = processing;
    renderWithProviders(<HomeSummary summary={summary} />);
    expect(screen.queryByTestId('home-voice-processing-inline')).toBeNull();
    expect(screen.getByTestId('home-quick-action-voice')).toBeEnabled();
  }
);
