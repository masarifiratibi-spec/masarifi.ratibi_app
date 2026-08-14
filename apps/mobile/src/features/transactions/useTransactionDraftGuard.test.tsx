import React from 'react';
import { Alert, Pressable } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useTransactionDraftGuard } from './useTransactionDraftGuard';

afterEach(() => jest.restoreAllMocks());

function Probe({
  meaningful,
  discard
}: {
  meaningful: boolean;
  discard: () => Promise<void>;
}) {
  const requestClose = useTransactionDraftGuard({ meaningful, discard });
  return <Pressable testID="close" onPress={requestClose} />;
}

it('closes immediately when the draft is empty', () => {
  const back = jest.spyOn(router, 'back').mockImplementation(jest.fn());
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

  fireEvent.press(
    render(<Probe meaningful={false} discard={jest.fn()} />).getByTestId(
      'close'
    )
  );

  expect(back).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
});

it('discards a meaningful draft before closing', async () => {
  const discard = jest.fn().mockResolvedValue(undefined);
  const back = jest.spyOn(router, 'back').mockImplementation(jest.fn());
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[1]?.onPress?.();
  });

  fireEvent.press(
    render(<Probe meaningful discard={discard} />).getByTestId('close')
  );

  await waitFor(() => expect(discard).toHaveBeenCalledTimes(1));
  expect(back).toHaveBeenCalledTimes(1);
});
