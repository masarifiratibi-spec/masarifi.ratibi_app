import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { changeLocale, translate } from '@/localization/i18n';
import { completeCategorySelection } from '@/features/categories/category-selection-session';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import {
  fixtureAccounts,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceReview } from './VoiceReview';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

it('separates payment method and account and confirms uncertainty', () => {
  const proposal = fixtureProposalGroup({
    scenario: 'low_confidence',
    sessionId: 's',
    recordedAt: Date.now(),
    timezoneOffsetMinutes: 0
  }).proposals[0];
  const change = jest.fn();
  const confirm = jest.fn();
  renderWithProviders(
    <VoiceReview
      proposal={proposal}
      accounts={fixtureAccounts.filter((item) => item.status === 'active')}
      categories={fixtureCategories}
      onChange={change}
      onConfirmField={confirm}
      onRemove={jest.fn()}
    />
  );
  expect(
    screen.getByText(translate('voice.review.paymentMethod'))
  ).toBeTruthy();
  expect(screen.getByText(translate('voice.review.account'))).toBeTruthy();
  expect(screen.queryByText(fixtureAccounts[1].name)).toBeNull();
  expect(screen.queryByText(fixtureCategories[1].labelAr)).toBeNull();
  fireEvent.press(screen.getByText(translate('voice.review.confirmField')));
  expect(confirm).toHaveBeenCalledWith('amount');
});

it('returns a canonical category choice through the existing proposal update', () => {
  changeLocale('en');
  const proposal = fixtureProposalGroup({
    scenario: 'clear_en',
    sessionId: 'category',
    recordedAt: Date.now(),
    timezoneOffsetMinutes: 0
  }).proposals[0];
  const change = jest.fn();
  renderWithProviders(
    <VoiceReview
      proposal={proposal}
      accounts={fixtureAccounts.filter((item) => item.status === 'active')}
      categories={fixtureCategories}
      onChange={change}
      onConfirmField={jest.fn()}
      onRemove={jest.fn()}
    />
  );

  fireEvent.press(screen.getByLabelText(/Category Fuel/));
  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  completeCategorySelection(route.params.requestId, 'shopping');

  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({ categoryId: 'shopping' })
  );
});

it('derives a missing proposal currency from its account before parsing amount edits', () => {
  const account = { ...fixtureAccounts[0], currencyCode: 'OMR' };
  const proposal = {
    ...fixtureProposalGroup({
      scenario: 'clear_en',
      sessionId: 'missing-currency',
      recordedAt: Date.now(),
      timezoneOffsetMinutes: 0
    }).proposals[0],
    accountId: account.id,
    amountMinor: null,
    currencyCode: null
  };
  const change = jest.fn();
  renderWithProviders(
    <VoiceReview
      proposal={proposal}
      accounts={[account]}
      categories={fixtureCategories}
      onChange={change}
      onConfirmField={jest.fn()}
      onRemove={jest.fn()}
    />
  );

  fireEvent.changeText(
    screen.getByLabelText(translate('voice.review.amount')),
    '12.345'
  );

  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({ amountMinor: 12_345 })
  );
});
