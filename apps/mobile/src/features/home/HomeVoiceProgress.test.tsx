import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import type { HomeSummary as Summary } from '@/domain/core-finance';
import { HomeSummary } from './HomeSummary';

const mockVoice = {
  session: { state: 'ready', durationMs: 0, errorCode: null },
  stop: jest.fn(),
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
  ['ar', 'preparing', false],
  ['en', 'preparing', false],
  ['ar', 'requesting_permission', false],
  ['en', 'requesting_permission', false],
  ['ar', 'preparing', true],
  ['en', 'preparing', true]
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

it.each(['ar', 'en'] as const)(
  'shows analysis after Stop until automatic posting finishes in %s',
  (locale) => {
    changeLocale(locale);
    mockVoice.session.state = 'recording';
    mockVoice.session.durationMs = 5000;
    mockVoice.batches.processing = false;
    let refresh: () => void = () => undefined;
    function VoiceFixture() {
      const [, update] = React.useReducer(
        (revision: number) => revision + 1,
        0
      );
      refresh = update;
      return <HomeSummary summary={{ ...summary }} />;
    }
    mockVoice.stop.mockImplementation(() => {
      mockVoice.session.state = 'stopping';
      refresh();
    });
    renderWithProviders(<VoiceFixture />);
    expect(screen.getByTestId('home-inline-voice-recording')).toBeEnabled();
    expect(screen.queryByTestId('home-voice-processing-inline')).toBeNull();

    fireEvent.press(screen.getByTestId('home-inline-voice-recording'));
    expect(
      screen.getByTestId('home-voice-processing-inline')
    ).toBeOnTheScreen();
    expect(
      screen.getByText(translate('voice.state.processing'))
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('home-voice-processing-cancel')).toBeNull();

    act(() => {
      mockVoice.session.state = 'ready';
      mockVoice.batches.processing = true;
      refresh();
    });
    expect(
      screen.getByTestId('home-voice-processing-inline')
    ).toBeOnTheScreen();
    expect(screen.getByTestId('home-quick-action-voice')).toBeEnabled();

    act(() => {
      mockVoice.batches.processing = false;
      refresh();
    });
    expect(screen.queryByTestId('home-voice-processing-inline')).toBeNull();
    expect(
      screen.queryByText(translate('voice.batch.event.committed'))
    ).toBeNull();
  }
);
