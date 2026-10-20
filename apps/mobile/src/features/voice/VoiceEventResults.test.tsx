import React from 'react';
import { screen } from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceBatchStatus } from './VoiceBatchStatus';
import type { useVoiceBatches } from './useVoiceBatches';
import type { VoiceBatchResult } from '@/services/live/voice-batch-api-service';

const tx = '33333333-3333-4333-8333-333333333333';
const latest = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  batchId: '22222222-2222-4222-8222-222222222222',
  status: 'completed' as const,
  addedCount: 1,
  transactionIds: [tx],
  ledgerVersion: 1,
  outcomes: [
    {
      ordinal: 0,
      kind: 'expense' as const,
      status: 'committed' as const,
      reason: null,
      transactionId: tx
    },
    {
      ordinal: 1,
      kind: null,
      status: 'skipped' as const,
      reason: 'ambiguous_account' as const,
      transactionId: null
    },
    {
      ordinal: 2,
      kind: null,
      status: 'skipped' as const,
      reason: 'unsupported_event' as const,
      transactionId: null
    }
  ]
};
const fixture = (
  result: VoiceBatchResult = latest
): ReturnType<typeof useVoiceBatches> => ({
  latest: result,
  results: [result],
  pendingIds: [],
  cancelIds: [],
  uncertain: false,
  localFailure: false,
  localFailureCode: undefined,
  processing: false,
  submit: () => undefined,
  recover: async () => undefined,
  cancel: async () => undefined
});
it.each([
  ['ar', 'تم حفظ 1 معاملة، ولم تُحفظ 2.'],
  ['en', 'Saved 1 transaction(s); 2 were not saved.']
] as const)(
  'summarizes partial persistence in %s without internal events',
  (locale, message) => {
    changeLocale(locale);
    renderWithProviders(<VoiceBatchStatus batches={fixture()} />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(
      screen.queryByText(/Event|الحدث|بانتظار الإكمال|Waiting to finish/)
    ).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  }
);
it('shows only processing until the batch has a terminal receipt', () => {
  changeLocale('en');
  renderWithProviders(
    <VoiceBatchStatus
      batches={{
        ...fixture({
          ...latest,
          status: 'finalizing',
          addedCount: 0,
          transactionIds: [],
          ledgerVersion: 0,
          outcomes: [
            {
              ordinal: 0,
              kind: 'expense',
              status: 'eligible',
              reason: null,
              transactionId: null
            }
          ]
        }),
        processing: true
      }}
    />
  );
  expect(screen.getByText('Analyzing recording...')).toBeTruthy();
  expect(screen.queryByText(/Event|Saved|Waiting/)).toBeNull();
});
it.each([
  { ledgerVersion: 0 },
  { addedCount: 2, transactionIds: [tx, tx] },
  { transactionIds: ['44444444-4444-4444-8444-444444444444'] }
])('never announces persistence for an inconsistent receipt %#', (invalid) => {
  changeLocale('en');
  renderWithProviders(
    <VoiceBatchStatus batches={fixture({ ...latest, ...invalid })} />
  );
  expect(screen.queryByText(/Saved/)).toBeNull();
});
it.each(['failed', 'cancelled'] as const)(
  'reports saved movements even if the remainder is %s',
  (status) => {
    changeLocale('en');
    renderWithProviders(
      <VoiceBatchStatus batches={fixture({ ...latest, status })} />
    );
    expect(
      screen.getByText('Saved 1 transaction(s); 2 were not saved.')
    ).toBeTruthy();
    expect(
      screen.queryByText('Some processing could not be completed.')
    ).toBeNull();
  }
);
it.each(['failed', 'cancelled'] as const)(
  'keeps a legacy partial %s honest when occurrence counts are unavailable',
  (status) => {
    changeLocale('en');
    renderWithProviders(
      <VoiceBatchStatus
        batches={fixture({ ...latest, status, outcomes: undefined })}
      />
    );
    expect(
      screen.getByText(
        'Saved 1 transaction(s); the rest of the recording could not be saved.'
      )
    ).toBeTruthy();
  }
);

it('keeps a fully saved recording silent after its ledger receipt', () => {
  changeLocale('en');
  renderWithProviders(
    <VoiceBatchStatus
      batches={fixture({ ...latest, outcomes: latest.outcomes.slice(0, 1) })}
    />
  );
  expect(screen.queryByText('Saved 1 transaction(s).')).toBeNull();
  expect(screen.queryByText('Some processing could not be completed.')).toBeNull();
});
