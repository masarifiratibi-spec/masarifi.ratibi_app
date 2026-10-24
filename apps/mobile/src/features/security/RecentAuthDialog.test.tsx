import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { RecentAuthDialog } from './RecentAuthDialog';

let mockHandler: (() => Promise<string | null>) | undefined;
const mockSession = {
  id: 'session-owner',
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
  configureRecentAuthHandler: (handler?: () => Promise<string | null>) => {
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
