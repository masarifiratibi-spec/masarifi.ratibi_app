import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { translate } from '@/localization/i18n';
import type { RecentAuthOptions } from '@/services/live/http-client';
import { RecentAuthDialog } from './RecentAuthDialog';

let mockHandler:
  ((options?: RecentAuthOptions) => Promise<string | null>) | undefined;
const mockSession = {
  id: 'session-owner',
  createdAt: new Date(0),
  factorVerificationAge: [0, -1],
  startVerification: jest.fn(async () => ({
    status: 'needs_first_factor',
    supportedFirstFactors: [
      {
        strategy: 'email_code',
        emailAddressId: 'email-owner',
        safeIdentifier: 'o***@example.test'
      }
    ]
  })),
  prepareFirstFactorVerification: jest.fn(async () => undefined),
  verifyWithPasskey: jest.fn(async () => ({ status: 'complete' })),
  attemptFirstFactorVerification: jest.fn(async () => ({ status: 'complete' })),
  getToken: jest.fn(async () => 'fresh-owner-token')
};
jest.mock('@clerk/expo', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    sessionId: 'session-owner'
  }),
  getClerkInstance: () => ({ session: mockSession, user: { id: 'user_owner' } })
}));
jest.mock('@/services/live/http-client', () => ({
  configureRecentAuthHandler: (
    handler?: (options?: RecentAuthOptions) => Promise<string | null>
  ) => {
    mockHandler = handler;
  }
}));

it('verifies with the real session boundary and cancels without producing a credential', async () => {
  const view = render(<RecentAuthDialog enabled sessionId="session-owner" />);
  let pending!: Promise<string | null>;
  await act(async () => {
    pending = mockHandler!();
  });
  await waitFor(() =>
    expect(screen.getByTestId('recent-auth-input')).toBeTruthy()
  );
  fireEvent.changeText(screen.getByTestId('recent-auth-input'), '123456');
  await act(async () =>
    fireEvent.press(screen.getByTestId('recent-auth-confirm'))
  );
  await expect(pending).resolves.toBe('fresh-owner-token');
  expect(mockSession.prepareFirstFactorVerification).toHaveBeenCalledWith({
    strategy: 'email_code',
    emailAddressId: 'email-owner'
  });
  expect(mockSession.attemptFirstFactorVerification).toHaveBeenCalledWith({
    strategy: 'email_code',
    code: '123456'
  });
  await act(async () => {
    pending = mockHandler!();
  });
  await act(async () =>
    fireEvent.press(screen.getByTestId('recent-auth-cancel'))
  );
  await expect(pending).resolves.toBeNull();
  view.unmount();
});

it('uses an offered password when no code factor exists', async () => {
  mockSession.startVerification.mockResolvedValueOnce({
    status: 'needs_first_factor',
    supportedFirstFactors: [{ strategy: 'password' }]
  } as never);
  render(<RecentAuthDialog enabled sessionId="session-owner" />);
  let pending!: Promise<string | null>;
  await act(async () => {
    pending = mockHandler!();
  });
  const field = await screen.findByTestId('recent-auth-input');
  expect(field.props.accessibilityLabel).toBe(translate('recentAuth.password'));
  fireEvent.changeText(field, 'example-password');
  await act(async () =>
    fireEvent.press(screen.getByTestId('recent-auth-confirm'))
  );
  await expect(pending).resolves.toBe('fresh-owner-token');
  expect(mockSession.attemptFirstFactorVerification).toHaveBeenLastCalledWith({
    strategy: 'password',
    password: 'example-password'
  });
});

it.each([true, false])(
  'offers an enrolled-factor-free SSO session only when newly signed in (%s)',
  async (fresh) => {
    mockSession.createdAt = fresh ? new Date() : new Date(0);
    mockSession.startVerification.mockResolvedValueOnce({
      status: 'needs_first_factor',
      supportedFirstFactors: []
    });
    render(<RecentAuthDialog enabled sessionId="session-owner" />);
    let pending!: Promise<string | null>;
    await act(async () => {
      pending = mockHandler!({ allowRecentSignIn: true });
    });
    if (fresh) {
      await act(async () =>
        fireEvent.press(
          await screen.findByLabelText(translate('recentAuth.useSignIn'))
        )
      );
      await expect(pending).resolves.toBe('fresh-owner-token');
    } else {
      expect(
        await screen.findByText(translate('recentAuth.unsupported'))
      ).toBeTruthy();
      expect(
        screen.queryByLabelText(translate('recentAuth.useSignIn'))
      ).toBeNull();
      fireEvent.press(screen.getByTestId('recent-auth-cancel'));
      await expect(pending).resolves.toBeNull();
    }
  }
);

it('uses the offered passkey without prompting for an OTP', async () => {
  mockSession.startVerification.mockResolvedValueOnce({
    status: 'needs_first_factor',
    supportedFirstFactors: [{ strategy: 'passkey' }]
  } as never);
  render(<RecentAuthDialog enabled sessionId="session-owner" />);
  let pending!: Promise<string | null>;
  await act(async () => {
    pending = mockHandler!();
  });
  expect(screen.queryByTestId('recent-auth-input')).toBeNull();
  await act(async () =>
    fireEvent.press(await screen.findByTestId('recent-auth-confirm'))
  );
  await expect(pending).resolves.toBe('fresh-owner-token');
  expect(mockSession.verifyWithPasskey).toHaveBeenCalled();
});
