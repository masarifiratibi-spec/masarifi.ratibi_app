import { Platform } from 'react-native';
import { getClerkInstance } from '@clerk/expo';
import { signInAsync } from 'expo-apple-authentication';
import { requestJson } from './live/http-client';
import { prepareAppleDeletion } from './apple-deletion-authorization';

jest.mock('@clerk/expo', () => ({ getClerkInstance: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({ signInAsync: jest.fn() }));
jest.mock('./live/http-client', () => ({
  ...jest.requireActual('./live/http-client'),
  requestJson: jest.fn()
}));

const actor = {
  userId: 'owner-a',
  token: 'fixture',
  sessionId: 'session-a',
  assertCurrent: async () => {}
};
const session = {
  id: actor.sessionId,
  getToken: jest.fn(async () => 'fixture')
};
let user: { id: string };
beforeEach(() => {
  jest.resetAllMocks();
  session.getToken.mockResolvedValue('fixture');
  jest.replaceProperty(Platform, 'OS', 'ios');
  user = { id: actor.userId };
  (getClerkInstance as jest.Mock).mockImplementation(() => ({ session, user }));
});
afterEach(() => jest.restoreAllMocks());

it('requests fresh Apple authorization only for missing grants and verifies progress', async () => {
  const send = requestJson as jest.Mock;
  send
    .mockResolvedValueOnce({ remaining: 1 })
    .mockResolvedValueOnce({ remaining: 0 })
    .mockResolvedValueOnce({ remaining: 0 });
  (signInAsync as jest.Mock).mockResolvedValueOnce({
    authorizationCode: 'one-time-fixture'
  });
  await prepareAppleDeletion(actor);
  expect(send.mock.calls.map((call) => call[2].body)).toEqual([
    {},
    { authorizationCode: 'one-time-fixture' },
    {}
  ]);
  expect(signInAsync).toHaveBeenCalledTimes(1);
});

it('preserves the deletion gate after cancellation or an authorization for the wrong linked account', async () => {
  (requestJson as jest.Mock).mockResolvedValue({ remaining: 1 });
  (signInAsync as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('cancel'), { code: 'ERR_REQUEST_CANCELED' })
  );
  await expect(prepareAppleDeletion(actor)).rejects.toMatchObject({
    status: 409
  });
  (signInAsync as jest.Mock).mockResolvedValueOnce({
    authorizationCode: 'unmatched-fixture'
  });
  await expect(prepareAppleDeletion(actor)).rejects.toMatchObject({
    status: 409
  });
  expect(signInAsync).toHaveBeenCalledTimes(2);
});

it('discards a late native authorization after the active owner changes', async () => {
  (requestJson as jest.Mock).mockResolvedValueOnce({ remaining: 1 });
  (signInAsync as jest.Mock).mockImplementationOnce(async () => {
    user = { id: 'owner-b' };
    return { authorizationCode: 'late-fixture' };
  });
  await expect(prepareAppleDeletion(actor)).rejects.toMatchObject({
    code: 'session_expired'
  });
  expect(requestJson).toHaveBeenCalledTimes(1);
});
