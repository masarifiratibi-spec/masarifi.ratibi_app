import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { changeLocale, translate, translateDynamic as t } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { AssistantActionPreviewScreen } from './AssistantActionPreviewScreen';
import { buildAssistantActionDisclosure } from '@/domain/assistant-action-disclosure';
import { livePreview, samples } from '@/test-utils/assistant-action-preview-fixtures';
import { usePreferenceStore } from '@/state/preferences';

const mockAssistantQueries = {
  useAssistantActionPreview: jest.fn(),
  useUpdateAssistantActionPreview: jest.fn(),
  useConfirmAssistantAction: jest.fn(),
  useCancelAssistantAction: jest.fn()
};

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('./assistant-queries', () => mockAssistantQueries);

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  usePreferenceStore.setState({hideBalances: false});
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({ data: preview(), isLoading: false, isError: false });
  mockAssistantQueries.useUpdateAssistantActionPreview.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockAssistantQueries.useCancelAssistantAction.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

test.each(samples)('fully discloses $kind and requires explicit confirmation', (sample) => {
  const value = livePreview(sample);
  const disclosure = buildAssistantActionDisclosure(value, sample.context, 'en');
  expect(disclosure.complete).toBe(true);
  const confirm = jest.fn();
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({ mutate: confirm, isPending: false });
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({ data: {...value, disclosure}, isError: false });
  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);
  for (const field of disclosure.fields) expect(screen.getAllByLabelText(new RegExp(t(field.labelKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).length).toBeGreaterThan(0);
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirmNow')));
  expect(confirm).toHaveBeenCalledTimes(1);
});

test('blocks an incomplete disclosure and lets the user refresh through reads', async () => {
  const confirm = jest.fn(), reset = jest.fn(), refetch = jest.fn().mockResolvedValue({data: livePreview(samples[1])});
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({mutate: confirm, reset, isPending: false});
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({data: {...livePreview(samples[1]), disclosure: {complete: false, reason: 'incomplete', scopeKey: 'assistant.actionPreview.scope.unavailable', fields: []}}, refetch});
  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);
  expect(screen.getByText(t('assistant.actionPreview.state.incomplete'))).toBeTruthy();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.checkStatus')));
  await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('does not confirm changed effect fields after the dialog was opened', () => {
  const sample = samples[3], value = livePreview(sample), confirm = jest.fn();
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({mutate: confirm, isPending: false});
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({data: {...value, disclosure: buildAssistantActionDisclosure(value, sample.context, 'en')}});
  let notifyQuery = () => {};
  function Harness() {
    const [, setTick] = React.useState(0);
    notifyQuery = () => setTick(tick => tick + 1);
    return <AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />;
  }
  renderWithProviders(<Harness />);
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  const changed = {...value, effect: {...sample.effect, name: 'Changed sample goal'}};
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({data: {...changed, disclosure: buildAssistantActionDisclosure(changed, {}, 'en')}});
  act(notifyQuery);
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirmNow')));
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByText(t('assistant.actionPreview.state.error'))).toBeTruthy();
});

test('unknown confirmation outcome offers a GET status check without another mutation', async () => {
  const value = livePreview(samples[3]), confirm = jest.fn(), reset = jest.fn();
  const refetch = jest.fn().mockResolvedValue({data: {...value, status: 'confirming'}});
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({mutate: confirm, reset, isPending: false, isError: true, error: {code: 'outcome_unknown'}});
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({data: {...value, disclosure: buildAssistantActionDisclosure(value, {}, 'en')}, refetch});
  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);
  expect(screen.getByText(t('assistant.actionPreview.state.unknown'))).toBeTruthy();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.checkStatus')));
  await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
});

test.each(['draft','confirming','succeeded','cancelled'] as const)('blocks new confirmation for %s status', (status) => {
  const value = livePreview(samples[3]), confirm = jest.fn();
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({mutate: confirm, isPending: false});
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({data: {...value, status, disclosure: buildAssistantActionDisclosure(value, {}, 'en')}});
  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  expect(confirm).not.toHaveBeenCalled();
});

test('localizes Arabic fields while retaining exact record names and currency units', () => {
  changeLocale('ar');
  const value = {...livePreview(samples[3]), effect: {...samples[3].effect, name: 'manual'}};
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({data: {...value, disclosure: buildAssistantActionDisclosure(value, {}, 'ar')}});
  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);
  expect(screen.getByLabelText(/الاسم.*manual/)).toBeTruthy();
  expect(screen.getByLabelText(/المبلغ المستهدف.*KWD/)).toBeTruthy();
  expect(screen.queryByText('assistant.actionPreview.field.scope')).toBeNull();
});

test('requires explicit local disclosure when balances are hidden without changing that preference', () => {
  usePreferenceStore.setState({hideBalances: true});
  const value = livePreview(samples[3]), confirm = jest.fn();
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({mutate: confirm, isPending: false});
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({data: {...value, disclosure: buildAssistantActionDisclosure(value, {}, 'en')}});
  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);
  expect(screen.queryByLabelText(/Target amount.*50\.000/)).toBeNull();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.revealEffects')));
  expect(screen.getByLabelText(/Target amount.*50\.000.*KWD/)).toBeTruthy();
  expect(usePreferenceStore.getState().hideBalances).toBe(true);
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirmNow')));
  expect(confirm).toHaveBeenCalledTimes(1);
});

test('remasks revealed preview effects on background and blocks the open confirmation', () => {
  const { AppState } = require('react-native');
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((...args: unknown[]) => {
    listeners.push(args[1] as (state: string) => void);
    return { remove: jest.fn() };
  });
  usePreferenceStore.setState({hideBalances: true});
  const value = livePreview(samples[3]), confirm = jest.fn();
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({mutate: confirm, isPending: false});
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({data: {...value, disclosure: buildAssistantActionDisclosure(value, {}, 'en')}});
  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.revealEffects')));
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  act(() => { listeners.forEach(listener => listener('background')); });
  act(() => { listeners.forEach(listener => listener('active')); });
  expect(screen.queryByLabelText(/Target amount.*50\.000/)).toBeNull();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirmNow')));
  expect(confirm).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

test('discloses destination and values but hides unsupported preview editing', () => {
  const update = jest.fn();
  const cancel = jest.fn();
  mockAssistantQueries.useUpdateAssistantActionPreview.mockReturnValue({ mutate: update, isPending: false });
  mockAssistantQueries.useCancelAssistantAction.mockReturnValue({ mutate: cancel, isPending: false });

  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);

  expect(screen.getByText(t('assistant.actionPreview.destination.goal'))).toBeTruthy();
  expect(screen.getByLabelText(/Savings goal.*300.00 SAR/)).toBeTruthy();
  expect(screen.getByText(t('assistant.actionPreview.value.amount'))).toBeTruthy();
  expect(screen.getByText('300.00 SAR')).toBeTruthy();

  expect(screen.queryByLabelText(t('assistant.actionPreview.input.amount'))).toBeNull();
  expect(screen.queryByText(t('assistant.actionPreview.action.saveEdit'))).toBeNull();
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.cancel')));
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.back')));

  expect(update).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledWith(expect.objectContaining({ previewId: 'preview-1', expectedVersion: 1 }));
  expect(router.back).toHaveBeenCalled();
});

test('requires confirmation dialog before mutating and routes to the safe success destination', () => {
  const confirm = jest.fn((_input, options) => options?.onSuccess?.({ value: { ...preview(), status: 'succeeded', resultReference: 'goal-1' } }));
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({ mutate: confirm, isPending: false });

  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);

  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  fireEvent.press(screen.getByText(translate('coreFinance.cancel')));
  expect(confirm).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirmNow')));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith('/savings/goal-1');
});

test('allows retry after failed confirmation while still blocking duplicate in-flight taps', () => {
  const confirm = jest
    .fn()
    .mockImplementationOnce((_input, options) => options?.onError?.({ code: 'offline' }))
    .mockImplementationOnce((_input, options) => options?.onSuccess?.({ value: { ...preview(), status: 'succeeded', resultReference: 'goal-1' } }));
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({ mutate: confirm, isPending: false });

  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);

  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirmNow')));
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirmNow')));

  expect(confirm).toHaveBeenCalledTimes(2);
  expect(router.push).toHaveBeenCalledWith('/savings/goal-1');
});

test('routes navigation previews to typed non-goal destinations', () => {
  const update = jest.fn();
  const confirm = jest.fn((_input, options) => options?.onSuccess?.({
    value: { ...preview(), kind: 'show_subscriptions', input: {}, affectedDestination: { kind: 'subscriptions' }, expiresAt: null, status: 'succeeded', resultReference: 'subscriptions' }
  }));
  mockAssistantQueries.useUpdateAssistantActionPreview.mockReturnValue({ mutate: update, isPending: false });
  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({
    data: { ...preview(), kind: 'show_subscriptions', input: {}, affectedDestination: { kind: 'subscriptions' }, expiresAt: null },
    isLoading: false,
    isError: false
  });
  mockAssistantQueries.useConfirmAssistantAction.mockReturnValue({ mutate: confirm, isPending: false });

  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);

  expect(screen.getByText(t('assistant.actionPreview.destination.subscriptions'))).toBeTruthy();
  expect(screen.queryByText(t('assistant.actionPreview.value.amount'))).toBeNull();
  expect(screen.queryByText('0.00 SAR')).toBeNull();
  expect(screen.queryByText(t('assistant.actionPreview.action.saveEdit'))).toBeNull();

  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirm')));
  fireEvent.press(screen.getByText(t('assistant.actionPreview.action.confirmNow')));

  expect(update).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith('/subscriptions');
});

test('shows stale, expired, safe failure, and offline states without confirmation', () => {
  for (const [status, label] of [
    ['stale', 'assistant.actionPreview.state.stale'],
    ['expired', 'assistant.actionPreview.state.expired'],
    ['failed', 'assistant.actionPreview.failure.reviewRequired']
  ] as const) {
    mockAssistantQueries.useAssistantActionPreview.mockReturnValue({ data: { ...preview(), status, safeFailure: status === 'failed' ? 'review_required' : null }, isLoading: false, isError: false });
    const rendered = renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId={`preview-${status}`} />);
    expect(screen.getByText(t(label))).toBeTruthy();
    expect(screen.queryByText(t('assistant.actionPreview.action.confirm'))).toBeNull();
    rendered.unmount();
  }

  mockAssistantQueries.useAssistantActionPreview.mockReturnValue({ data: null, isLoading: false, isError: true, error: { code: 'offline' } });
  renderWithProviders(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-offline" />);
  expect(screen.getByText(t('assistant.actionPreview.state.offline'))).toBeTruthy();
});

function preview({
  currency = 'SAR',
  amountMinor = 30_000
}: {
  currency?: string;
  amountMinor?: number;
} = {}) {
  return {
    id: 'preview-1',
    responseId: 'response-1',
    kind: 'create_goal',
    input: { amountMinor, currency },
    affectedDestination: { kind: 'goal', goalId: 'draft-goal' },
    sourceVersions: [{ id: 'budget-1', version: 2 }],
    status: 'ready',
    operationId: null,
    expiresAt: Date.UTC(2027, 0, 15, 12, 10),
    resultReference: null,
    safeFailure: null,
    version: 1
  };
}
