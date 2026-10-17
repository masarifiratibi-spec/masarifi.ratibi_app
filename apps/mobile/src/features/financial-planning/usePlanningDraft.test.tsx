import React, { useState } from 'react';
import { Text, TextInput, Pressable } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { financialPlanningService } from '@/services/financial-planning-service';
import { createMockFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePlanningFormDraft } from './usePlanningDraft';

jest.mock('@/services/financial-planning-service', () => {
  const { createMockFinancialPlanningService: create } = jest.requireActual<
    typeof import('@/services/mocks/financial-planning-service')
  >('@/services/mocks/financial-planning-service');
  return { financialPlanningService: create() };
});

function DraftForm() {
  const [amount, setAmount] = useState('1000');
  const [discarded, setDiscarded] = useState(false);
  const { draftReady, discardDraft } = usePlanningFormDraft({
    id: 'audit-draft',
    kind: 'salary',
    entityId: null,
    payload: { amount },
    meaningful: true,
    restore: () => {},
    onError: () => {}
  });
  return (
    <>
      <Text>{draftReady ? 'Ready' : 'Loading'}</Text>
      <TextInput
        accessibilityLabel="Amount"
        value={amount}
        onChangeText={setAmount}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Discard"
        onPress={() => {
          void discardDraft().then(() => setDiscarded(true));
        }}
      >
        <Text>Discard</Text>
      </Pressable>
      {discarded ? <Text>Discarded</Text> : null}
    </>
  );
}

beforeEach(() => {
  Object.assign(financialPlanningService, createMockFinancialPlanningService());
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('cancels queued autosave on discard, without losing later edits', async () => {
  const view = render(<DraftForm />);
  try {
    await screen.findByText('Ready');
    fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    await screen.findByText('Discarded');
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(await financialPlanningService.loadDraft('audit-draft')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Amount'), '2000');
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(
      (await financialPlanningService.loadDraft('audit-draft'))?.payload
    ).toEqual({ amount: '2000' });
    fireEvent.changeText(screen.getByLabelText('Amount'), '1000');
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(
      (await financialPlanningService.loadDraft('audit-draft'))?.payload
    ).toEqual({ amount: '1000' });
  } finally {
    view.unmount();
  }
});

it('waits for an in-flight draft write before deleting it', async () => {
  const save = financialPlanningService.saveDraft;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const spy = jest
    .spyOn(financialPlanningService, 'saveDraft')
    .mockImplementation(async (draft) => {
      await pending;
      return save(draft);
    });
  const view = render(<DraftForm />);
  try {
    await screen.findByText('Ready');
    await act(async () => jest.advanceTimersByTimeAsync(300));
    fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    await act(async () => release());
    await screen.findByText('Discarded');
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(await financialPlanningService.loadDraft('audit-draft')).toBeNull();
  } finally {
    view.unmount();
    spy.mockRestore();
  }
});
