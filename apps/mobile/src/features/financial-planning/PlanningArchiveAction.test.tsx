import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { changeLocale, translate } from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { useAppShellStore } from '@/state/app-shell';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { fixtureSalaryProfile, fixtureObligation } from '@/test-utils/financial-planning-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { PlanningArchiveAction } from './PlanningArchiveAction';

beforeEach(() => {
  changeLocale('en');
  useAppShellStore.setState({ session: authenticatedSession });
});
afterEach(() => {
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
  useAppShellStore.setState({ session: null });
});

it.each(['salary', 'obligation'] as const)('confirms the named %s and sends only its displayed version', async (kind) => {
  const salary = jest.spyOn(financialPlanningService, 'archiveSalaryProfile')
    .mockResolvedValue({ value: fixtureSalaryProfile, affectedScopes: [] });
  const obligation = jest.spyOn(financialPlanningService, 'setObligationStatus')
    .mockResolvedValue({ value: fixtureObligation, affectedScopes: [] });
  const view = renderWithProviders(<PlanningArchiveAction kind={kind} id="item" version={7} name="Example" />);
  const label = translate(`planning.${kind}.archive`);
  fireEvent.press(view.getByRole('button', { name: label }));
  expect(view.getByText(/Archive Example\?/)).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: translate('coreFinance.cancel') }));
  expect(salary).not.toHaveBeenCalled();
  expect(obligation).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: label }));
  fireEvent.press(view.getAllByRole('button', { name: label }).at(-1)!);
  await waitFor(() => kind === 'salary'
    ? expect(salary).toHaveBeenCalledWith('item', 7, 'archive:salary:item:7')
    : expect(obligation).toHaveBeenCalledWith('item', 7, 'archived', 'archive:obligation:item:7'));
});

it('does not submit a previous owner’s confirmation or queue an offline archive for reconnection', async () => {
  const archive = jest.spyOn(financialPlanningService, 'archiveSalaryProfile');
  const view = renderWithProviders(<PlanningArchiveAction kind="salary" id="item" version={1} name="Example" />);
  const label = translate('planning.salary.archive');
  fireEvent.press(view.getByRole('button', { name: label }));
  act(() => useAppShellStore.setState({ session: { ...authenticatedSession, userId: 'another-owner' } }));
  expect(view.queryByText(/Archive Example\?/)).toBeNull();
  act(() => onlineManager.setOnline(false));
  fireEvent.press(view.getByRole('button', { name: label }));
  fireEvent.press(view.getAllByRole('button', { name: label }).at(-1)!);
  expect(await view.findByText(translate('planning.archiveFailed'))).toBeTruthy();
  act(() => onlineManager.setOnline(true));
  expect(archive).not.toHaveBeenCalled();
});
