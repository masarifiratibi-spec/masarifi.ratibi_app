import { Platform } from 'react-native';
import { redirectSystemPath } from '@app/+native-intent';

const mockReceive = jest.fn(async (_path: string) => {});
jest.mock('@/services/platform/ios-shortcut-runtime', () => ({
  receiveIosShortcut: (path: string) => mockReceive(path)
}));
afterEach(() => jest.restoreAllMocks());
test('sanitizes cold and warm iOS capture links before they enter navigation state', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  for (const initial of [true, false]) {
    expect(
      await redirectSystemPath({
        path: 'masarifi://capture-ios?payload=%ZZ',
        initial
      })
    ).toBe('/capture/ios');
  }
});
test('Android keeps the existing URL handling and never loads an iOS receiver', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  mockReceive.mockClear();
  expect(redirectSystemPath({ path: 'masarifi://add', initial: true })).toBe(
    'masarifi://add'
  );
  expect(mockReceive).not.toHaveBeenCalled();
});
test('iOS capture errors cannot leak the URL into navigation or break SSO', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  mockReceive.mockRejectedValueOnce(
    Error('synthetic input must not be echoed')
  );
  expect(
    await redirectSystemPath({
      path: 'masarifi://capture-ios?payload=private',
      initial: true
    })
  ).toBe('/capture/ios');
  expect(
    redirectSystemPath({
      path: 'masarifi://sso-callback?code=private',
      initial: true
    })
  ).toBe('/');
});
test.each([
  'MASARIFI://CAPTURE-IOS?payload=private',
  'masarifi://user@capture-ios?payload=private',
  'masarifi:/capture-ios?payload=private'
])('also sanitizes malformed capture authorities: %s', async (path) => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  expect(await redirectSystemPath({ path, initial: true })).toBe(
    '/capture/ios'
  );
});
