import React from 'react';
import { Alert, Pressable } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

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
  const preventRemove: {
    current?: ReturnType<
      typeof jest.mocked<typeof usePreventRemove>
    >['mock']['calls'][number][1];
  } = {};
  const back = jest.spyOn(router, 'back').mockImplementation(() => {
    preventRemove.current?.({ data: { action: { type: 'GO_BACK' } } });
  });
  const alert = jest
    .spyOn(Alert, 'alert')
    .mockImplementationOnce((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });

  const screen = render(<Probe meaningful discard={discard} />);
  preventRemove.current = jest.mocked(usePreventRemove).mock.calls.at(-1)?.[1];
  fireEvent.press(screen.getByTestId('close'));

  await waitFor(() => expect(discard).toHaveBeenCalledTimes(1));
  expect(back).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledTimes(1);
});

it('guards hardware and gesture navigation with the same discard flow', async () => {
  const discard = jest.fn().mockResolvedValue(undefined);
  const dispatch = jest.fn();
  jest.mocked(useNavigation).mockReturnValue({ dispatch } as never);
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[1]?.onPress?.();
  });

  render(<Probe meaningful discard={discard} />);
  const callback = jest.mocked(usePreventRemove).mock.calls.at(-1)?.[1];
  callback?.({ data: { action: { type: 'GO_BACK' } } });

  await waitFor(() => expect(discard).toHaveBeenCalledTimes(1));
  expect(dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
});
