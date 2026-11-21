import React from 'react';
import { screen } from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceBatchStatus } from './VoiceBatchStatus';
import { translate } from '@/localization/i18n';

it('shows the retained-recording explanation on Home when the separate progress pill is hidden', () => {
  renderWithProviders(<VoiceBatchStatus showProgress={false} batches={{
    submit: () => undefined, recover: async () => undefined, cancel: async () => undefined,
    results: [], pendingIds: ['capture'], cancelIds: ['capture'], uncertain: false,
    localFailure: false, localFailureCode: undefined, processing: false,
    rateLimited: true, latest: null
  }} />);
  expect(screen.getByText(translate('voice.batch.rateLimited'))).toBeTruthy();
  expect(screen.queryByText(translate('voice.state.processing'))).toBeNull();
});

it('can hide historical zero-added copy on Home while retaining the result', () => {
  renderWithProviders(<VoiceBatchStatus showEmpty={false} batches={{
    submit: () => undefined, recover: async () => undefined, cancel: async () => undefined,
    results: [], pendingIds: [], cancelIds: [], uncertain: false, localFailure: false,
    localFailureCode: undefined, processing: false, rateLimited: false,
    latest: { sessionId: '11111111-1111-4111-8111-111111111111', batchId: null, status: 'completed', addedCount: 0, transactionIds: [], ledgerVersion: 0 }
  }} />);
  expect(screen.queryByText('لم تتم إضافة أي معاملات.')).toBeNull();
  expect(screen.queryByText('No transactions were added.')).toBeNull();
  expect(screen.queryByTestId('voice-batch-status')).toBeNull();
});

it.each([
  ['en', false, 'Analyzing recording...', 'Checking the result…'],
  ['en', true, 'Analyzing recording...', 'Checking the result…'],
  ['ar', false, 'جاري تحليل التسجيل...', 'جارٍ التحقق من النتيجة…'],
  ['ar', true, 'جاري تحليل التسجيل...', 'جارٍ التحقق من النتيجة…']
] as const)(
  'shows an honest pending status in %s when uncertainty is %s',
  (locale, uncertain, analyzing, checking) => {
    changeLocale(locale);
    const batches = {
      submit: () => undefined,
      recover: async () => undefined,
      cancel: async () => undefined,
      results: [],
      pendingIds: ['capture-pending'],
      cancelIds: ['capture-pending'],
      uncertain,
      localFailure: false,
      localFailureCode: undefined,
      processing: true,
      rateLimited: false,
      latest: null
    };
    renderWithProviders(<VoiceBatchStatus batches={batches} />);
    expect(screen.getByText(analyzing)).toBeTruthy();
    expect(screen.queryByText(checking)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  }
);

it.each(['ar', 'en'] as const)(
  'does not describe background recovery uncertainty as recording analysis in %s',
  (locale) => {
    changeLocale(locale);
    renderWithProviders(
      <VoiceBatchStatus
        batches={{
          submit: jest.fn(),
          recover: async () => undefined,
          cancel: async () => undefined,
          results: [],
          pendingIds: ['old-capture'],
          cancelIds: ['old-capture'],
          uncertain: true,
          processing: false,
          rateLimited: false,
          localFailure: false,
          localFailureCode: undefined,
          latest: null
        }}
      />
    );
    expect(
      screen.queryByText(
        locale === 'ar' ? 'جاري تحليل التسجيل...' : 'Analyzing recording...'
      )
    ).toBeNull();
  }
);
