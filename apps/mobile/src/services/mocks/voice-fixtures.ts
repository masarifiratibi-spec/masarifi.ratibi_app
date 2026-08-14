import {
  assessment,
  resolveSpokenDate,
  type VoiceProposalGroup,
  type VoiceScenario,
  type VoiceTranscript,
  type VoiceTransactionProposal
} from '@/domain/voice-capture';

const texts: Record<VoiceScenario, { text: string; language: VoiceTranscript['language'] }> = {
  clear_ar: { text: 'دفعت 80 ريال للبنزين كاش', language: 'ar' },
  clear_en: { text: 'I paid 80 riyals for fuel in cash', language: 'en' },
  mixed: { text: 'دفعت 250 ريال لـ Netflix بالبطاقة', language: 'mixed' },
  missing_account: { text: 'I bought coffee for 20 riyals', language: 'en' },
  unknown_merchant: { text: 'I paid 45 riyals at New Corner', language: 'en' },
  multiple: {
    text: 'Yesterday I paid 40 riyals for coffee and 120 riyals for groceries',
    language: 'en'
  },
  income: { text: 'I received my salary of 7000 riyals', language: 'en' },
  transfer: { text: 'I transferred 500 riyals to Ahmed', language: 'en' },
  obligation: { text: 'Record this month car installment 2500 riyals', language: 'en' },
  low_confidence: { text: 'I may have paid about 30 riyals', language: 'en' },
  failed_analysis: { text: 'I paid 50 riyals', language: 'en' },
  unsupported_language: { text: 'J ai payé vingt euros', language: 'unsupported' },
  no_speech: { text: '', language: 'en' },
  background_noise: { text: '', language: 'en' },
  offline: { text: 'I paid 50 riyals', language: 'en' }
};

export function fixtureTranscript(scenario: VoiceScenario, now = Date.now()): VoiceTranscript {
  const value = texts[scenario];
  return {
    ...value,
    confidence:
      scenario === 'low_confidence'
        ? 65
        : scenario === 'no_speech' || scenario === 'background_noise'
          ? 0
          : 96,
    capturedAt: now,
    editedByUser: false
  };
}

export function fixtureProposalGroup({
  scenario,
  sessionId,
  recordedAt,
  timezoneOffsetMinutes
}: {
  scenario: VoiceScenario;
  sessionId: string;
  recordedAt: number;
  timezoneOffsetMinutes: number;
}): VoiceProposalGroup {
  if (scenario === 'failed_analysis') throw new Error('analysis_failed');
  const occurredAt = resolveSpokenDate(
    scenario === 'multiple' ? 'yesterday' : 'today',
    recordedAt,
    timezoneOffsetMinutes
  ).value;
  const proposals = scenario === 'multiple'
    ? [
        proposal('coffee', 4_000, 'restaurants', occurredAt, { merchant: 'Coffee' }),
        proposal('groceries', 12_000, 'food', occurredAt, { merchant: 'Groceries' })
      ]
    : [singleProposal(scenario, occurredAt)];
  return {
    id: `group-${sessionId}-${scenario}`,
    sessionId,
    proposals,
    status: 'reviewing',
    saveErrorCode: null
  };
}

function singleProposal(scenario: VoiceScenario, occurredAt: number): VoiceTransactionProposal {
  if (scenario === 'income')
    return proposal('salary', 700_000, 'salary', occurredAt, {
      type: 'income',
      merchant: 'Salary'
    });
  if (scenario === 'transfer')
    return proposal('transfer', 50_000, null, occurredAt, {
      type: 'transfer',
      merchant: null,
      beneficiary: 'Ahmed',
      destinationAccountId: 'account-wallet',
      paymentMethod: 'transfer'
    });
  if (scenario === 'obligation')
    return proposal('car-installment', 250_000, 'obligations', occurredAt, {
      type: 'obligation_payment',
      merchant: 'Car installment',
      recurringSuggestion: {
        kind: 'existing_obligation',
        cadence: 'monthly',
        candidateObligationIds: ['car-installment'],
        confidence: 94,
        confirmed: false
      }
    });
  if (scenario === 'mixed')
    return proposal('netflix', 25_000, 'subscriptions', occurredAt, {
      merchant: 'Netflix',
      paymentMethod: 'card'
    });
  if (scenario === 'missing_account')
    return proposal('coffee', 2_000, 'restaurants', occurredAt, {
      merchant: 'Coffee',
      accountId: null,
      assessments: [assessment('account', 30)]
    });
  if (scenario === 'unknown_merchant')
    return proposal('new-corner', 4_500, 'shopping', occurredAt, {
      merchant: 'New Corner',
      assessments: [assessment('merchant', 65)]
    });
  if (scenario === 'low_confidence')
    return proposal('uncertain', 3_000, 'shopping', occurredAt, {
      merchant: 'Unknown',
      assessments: [assessment('amount', 65), assessment('merchant', 40)]
    });
  return proposal('fuel', 8_000, 'fuel', occurredAt, { merchant: 'Fuel', paymentMethod: 'cash' });
}

function proposal(
  id: string,
  amountMinor: number,
  categoryId: string | null,
  occurredAt: number,
  overrides: Partial<VoiceTransactionProposal> = {}
): VoiceTransactionProposal {
  return {
    id: `proposal-${id}`,
    type: 'expense',
    amountMinor,
    currencyCode: 'SAR',
    merchant: id,
    title: id,
    categoryId,
    paymentMethod: 'cash',
    accountId: 'account-bank',
    destinationAccountId: null,
    occurredAt,
    beneficiary: null,
    obligationId: null,
    duplicateOfTransactionId: null,
    notes: null,
    assessments: [
      assessment('type', 97),
      assessment('amount', 97),
      assessment('currency', 97),
      assessment('category', 94),
      assessment('date', 96)
    ],
    recurringSuggestion: null,
    selected: true,
    status: 'ready',
    categoryPreference: 'not_now',
    ...overrides
  };
}

export const voiceScenarios = Object.keys(texts) as VoiceScenario[];
