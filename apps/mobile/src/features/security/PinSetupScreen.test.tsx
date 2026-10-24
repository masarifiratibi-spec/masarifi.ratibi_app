import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { PinCredential } from '@/domain/app-shell';
import { createPinCredential } from './privacy-lock';
import { renderWithProviders } from '@/test-utils/render';
import { PinSetupScreen } from './PinSetupScreen';
import * as pinKdf from '@noble/hashes/pbkdf2';

let currentCredential: PinCredential;

beforeAll(async () => {
  const result = await createPinCredential('123456', '123456', async () =>
    Uint8Array.from({ length: 16 }, (_, index) => index)
  );
  if (!('credential' in result)) throw new Error('expected credential');
  currentCredential = result.credential;
});
function submit(pin: string) {
  fireEvent.changeText(screen.getByLabelText('رمز من ستة أرقام'), pin);
  fireEvent.press(screen.getByLabelText('تحقق'));
}

describe('PinSetupScreen', () => {
  it('creates a credential only after two matching entries', async () => {
    const onSave = jest.fn<Promise<void>, [PinCredential]>(
      async () => undefined
    );
    renderWithProviders(<PinSetupScreen mode="create" onSave={onSave} />);

    submit('654321');
    expect(await screen.findByText('تأكيد رمز PIN')).toBeOnTheScreen();
    expect(onSave).not.toHaveBeenCalled();

    submit('654321');
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1), {
      timeout: 5_000
    });
    expect(onSave.mock.calls[0]?.[0]).toMatch(
      /^pbkdf2-sha256:120000:[a-f0-9]{32}:[a-f0-9]{64}$/
    );
  });

  it('rejects mismatched confirmation without saving', async () => {
    const onSave = jest.fn();
    renderWithProviders(<PinSetupScreen mode="create" onSave={onSave} />);

    submit('654321');
    submit('123456');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'رمزا PIN غير متطابقين.'
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not retain the first PIN after unmount', () => {
    const first = renderWithProviders(
      <PinSetupScreen mode="create" onSave={jest.fn()} />
    );
    submit('654321');
    expect(screen.getByText('تأكيد رمز PIN')).toBeOnTheScreen();
    first.unmount();

    renderWithProviders(<PinSetupScreen mode="create" onSave={jest.fn()} />);
    expect(screen.getByText('إنشاء رمز PIN')).toBeOnTheScreen();
  });

  it('requires the current PIN before changing it', async () => {
    const onInvalidCurrent = jest.fn(async () => undefined);
    const onSave = jest.fn();
    renderWithProviders(
      <PinSetupScreen
        currentCredential={currentCredential}
        mode="change"
        onInvalidCurrent={onInvalidCurrent}
        onSave={onSave}
      />
    );

    submit('654321');
    await waitFor(() => expect(onInvalidCurrent).toHaveBeenCalledTimes(1));
    expect(onSave).not.toHaveBeenCalled();

    const derive = pinKdf.pbkdf2Async;
    const slowVerification = jest
      .spyOn(pinKdf, 'pbkdf2Async')
      .mockImplementationOnce(async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 1_250));
        return derive(...args);
      });
    try {
      submit('123456');
      expect(
        await screen.findByText('إنشاء رمز PIN', undefined, { timeout: 5_000 })
      ).toBeOnTheScreen();
      submit('111111');
      submit('111111');
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1), {
        timeout: 5_000
      });
    } finally {
      slowVerification.mockRestore();
    }
  }, 10_000);
});
