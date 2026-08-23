import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react-native';

import { changeLocale, translate, translateDynamic } from '@/localization/i18n';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { fixtureAccounts, fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceReviewGroup } from './VoiceReviewGroup';

beforeEach(() => changeLocale('en'));

function renderGroup(
  scenario: 'clear_en' | 'multiple',
  onChange = jest.fn()
) {
  const group = fixtureProposalGroup({
    scenario,
    sessionId: 's',
    recordedAt: Date.now(),
    timezoneOffsetMinutes: 0
  });
  renderWithProviders(
    <VoiceReviewGroup
      group={group}
      accounts={fixtureAccounts.filter((item) => item.status === 'active')}
      categories={fixtureCategories}
      onChange={onChange}
      onConfirmField={jest.fn()}
      onRemove={jest.fn()}
      onSave={jest.fn()}
      onSaveAll={jest.fn()}
      onReRecord={jest.fn()}
    />
  );
}

it('renders one detected transaction as one review card', () => {
  renderGroup('clear_en');

  expect(screen.getAllByTestId(/^voice-review-card-/)).toHaveLength(1);
});

it('renders three mixed proposals as separate review cards and group save actions', () => {
  const save = jest.fn();
  const saveAll = jest.fn();
  const group = fixtureProposalGroup({
    scenario: 'multiple', sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  });
  renderWithProviders(
    <VoiceReviewGroup
      group={group}
      accounts={fixtureAccounts.filter((item) => item.status === 'active')}
      categories={fixtureCategories}
      onChange={jest.fn()}
      onConfirmField={jest.fn()}
      onRemove={jest.fn()}
      onSave={save}
      onSaveAll={saveAll}
      onReRecord={jest.fn()}
    />
  );
  expect(
    screen.getByText(
      translateDynamic('voice.review.groupSummary', {
        selected: 3,
        total: 3
      })
    )
  ).toBeTruthy();
  expect(
    screen.getByText(
      translateDynamic('voice.review.proposalPosition', {
        current: 1,
        total: 3
      })
    )
  ).toBeTruthy();
  expect(screen.getAllByTestId(/^voice-review-card-/)).toHaveLength(3);
  expect(screen.getAllByText(translate('voice.review.amount'))).toHaveLength(3);
  const selected = translate('designSystem.state.selected');
  expect(
    within(screen.getByTestId('voice-review-card-proposal-coffee')).getByLabelText(
      `${translate('coreFinance.type.expense')} ${selected}`
    )
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('voice-review-card-proposal-salary')).getByLabelText(
      `${translate('coreFinance.type.income')} ${selected}`
    )
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('voice-review-card-proposal-transfer')).getByLabelText(
      `${translate('coreFinance.type.transfer')} ${selected}`
    )
  ).toBeTruthy();
  fireEvent.press(screen.getByText(translate('voice.review.confirmSelected')));
  expect(save).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText(translate('voice.review.confirmAll')));
  expect(saveAll).toHaveBeenCalledTimes(1);
});

it('routes an edit only to the changed proposal id', () => {
  const onChange = jest.fn();
  renderGroup('multiple', onChange);

  fireEvent.changeText(
    within(screen.getByTestId('voice-review-card-proposal-salary')).getByDisplayValue('7000'),
    '7100'
  );

  expect(onChange).toHaveBeenCalledWith(
    'proposal-salary',
    expect.objectContaining({ amountMinor: 710_000 })
  );
  expect(onChange).not.toHaveBeenCalledWith(
    'proposal-coffee',
    expect.anything()
  );
});

it.each([
  ['en', 'row'],
  ['ar', 'row-reverse']
] as const)('lays out proposal summaries for %s', (locale, flexDirection) => {
  changeLocale(locale);
  renderGroup('clear_en');

  expect(screen.getByTestId('voice-review-summary-proposal-fuel')).toHaveStyle({
    flexDirection
  });
});
