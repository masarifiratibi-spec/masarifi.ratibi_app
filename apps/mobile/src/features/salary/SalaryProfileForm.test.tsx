import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { financialPlanningKeys } from '@/features/financial-planning/financial-planning-queries';
import { changeLocale, translate, type MessageKey } from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { createMockFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { fixtureSalaryProfile } from '@/test-utils/financial-planning-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { SalaryProfileForm } from './SalaryProfileForm';

jest.mock('@/services/financial-planning-service', () => {
  const { createMockFinancialPlanningService: create } = jest.requireActual<
    typeof import('@/services/mocks/financial-planning-service')
  >('@/services/mocks/financial-planning-service');
  return { financialPlanningService: create() };
});

beforeEach(() => {
  Object.assign(financialPlanningService, createMockFinancialPlanningService());
  changeLocale('en');
  usePreferenceStore.setState({ baseCurrencyCode: 'SAR' });
});

function open(
  currencyCode = 'SAR',
  profile = null as typeof fixtureSalaryProfile | null
) {
  return renderWithQueryData(<SalaryProfileForm />, [
    [
      coreFinanceKeys.accounts(),
      [
        {
          ...fixtureAccounts[0],
          id: 'audit-account',
          name: 'Audit account',
          currencyCode
        }
      ]
    ],
    [financialPlanningKeys.salaryProfile(), profile]
  ]);
}

async function ready() {
  await screen.findByRole('header', {
    name: translate('planning.salary.setup')
  });
}

function edit(key: MessageKey, value: string) {
  fireEvent.press(
    screen.getByRole('button', { name: new RegExp(translate(key)) })
  );
  const input = screen
    .getAllByLabelText(translate(key))
    .find((node) => typeof node.props.onChangeText === 'function');
  if (!input) throw new Error('Editable input not found');
  fireEvent.changeText(input, value);
}

function fill(amount = '1000', day = '25') {
  edit('planning.salary.amount', amount);
  edit('planning.salary.day', day);
  edit('planning.salary.source', 'Audit employer');
}

function submit() {
  fireEvent.press(
    screen.getByRole('button', { name: translate('planning.action.save') })
  );
}

it.each(['25.5', 'abc', 'NaN', 'Infinity', '2e1', '0x10', '', '0', '32'])(
  'rejects invalid salary day %s before saving',
  async (day) => {
    open();
    await ready();
    fill('1000', day);
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent(
      translate('planning.salary.dayHelper')
    );
    expect(await financialPlanningService.getSalaryProfile()).toBeNull();
  }
);

it.each([
  ['١٬٢٥٠٫٥٠', '٢٥', 'SAR', 125050, 25],
  ['۱۲٫۳۴۵', '۳۱', 'OMR', 12345, 31],
  ['1000', '1', 'USD', 100000, 1]
] as const)(
  'saves localized salary %s and day %s in the receiving account currency',
  async (amount, day, currency, minor, expectedDay) => {
    open(currency);
    await ready();
    fill(amount, day);
    submit();
    await screen.findByText(translate('planning.state.saved'));
    expect(await financialPlanningService.getSalaryProfile()).toEqual(
      expect.objectContaining({
        expectedAmountMinor: minor,
        salaryDay: expectedDay,
        currencyCode: currency,
        receivingAccountId: 'audit-account'
      })
    );
  }
);

it('removes the saved confirmation when salary data is edited again', async () => {
  open();
  await ready();
  fill();
  submit();
  await screen.findByText(translate('planning.state.saved'));
  edit('planning.salary.amount', '2000');
  expect(screen.queryByText(translate('planning.state.saved'))).toBeNull();
  expect(
    (await financialPlanningService.getSalaryProfile())?.expectedAmountMinor
  ).toBe(100000);
});

it('does not recreate a discarded salary draft after saving, but retains subsequent edits', async () => {
  jest.useFakeTimers();
  const view = open();
  try {
    await ready();
    fill();
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(
      await financialPlanningService.loadDraft('planning-form-salary')
    ).not.toBeNull();
    submit();
    await screen.findByText(translate('planning.state.saved'));
    await act(async () => jest.advanceTimersByTimeAsync(1000));
    expect(
      await financialPlanningService.loadDraft('planning-form-salary')
    ).toBeNull();
    edit('planning.salary.amount', '2000');
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(
      (await financialPlanningService.loadDraft('planning-form-salary'))
        ?.payload
    ).toEqual(expect.objectContaining({ amount: '2000' }));
    fireEvent.changeText(screen.getByDisplayValue('2000'), '1000');
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(
      await financialPlanningService.loadDraft('planning-form-salary')
    ).toBeNull();
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

it('does not claim edits made during a save were saved', async () => {
  const save = financialPlanningService.saveSalaryProfile;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const spy = jest
    .spyOn(financialPlanningService, 'saveSalaryProfile')
    .mockImplementation(async (...args) => {
      await pending;
      return save(...args);
    });
  open();
  try {
    await ready();
    fill();
    submit();
    await waitFor(() => expect(spy).toHaveBeenCalled());
    edit('planning.salary.amount', '2000');
    await act(async () => release());
    await waitFor(async () =>
      expect(
        (await financialPlanningService.getSalaryProfile())?.expectedAmountMinor
      ).toBe(100000)
    );
    expect(screen.queryByText(translate('planning.state.saved'))).toBeNull();
    expect(screen.getByDisplayValue('2000')).toBeTruthy();
  } finally {
    spy.mockRestore();
  }
});

it('shows automatic detection as unavailable without altering an existing preference', async () => {
  const profile = {
    ...fixtureSalaryProfile,
    receivingAccountId: 'audit-account'
  };
  await financialPlanningService.saveSalaryProfile(profile, 'existing-profile');
  open('SAR', profile);
  await ready();
  expect(
    screen.queryByRole('switch', {
      name: translate('planning.salary.automaticDetection')
    })
  ).toBeNull();
  expect(
    screen.getByText(translate('planning.salary.automaticDetectionSubtitle'))
  ).toBeTruthy();
  submit();
  await screen.findByText(translate('planning.state.saved'));
  expect(
    (await financialPlanningService.getSalaryProfile())
      ?.automaticDetectionEnabled
  ).toBe(true);
});
