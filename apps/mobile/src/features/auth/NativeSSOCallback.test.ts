import { redirectSystemPath } from '@app/+native-intent';
import { parseDeepLinkDestination } from '@/features/shell/deep-link-controller';
import { Linking, Platform } from 'react-native';
import { getLinkingConfig } from 'expo-router/build/getLinkingConfig';
import type { RouteNode } from 'expo-router/build/Route';

test.each([true, false])(
  'routes the %s native callback to clean bootstrap without copying its parameters',
  (initial) => {
    const callback =
      'masarifi://sso-callback?rotating_token_nonce=fixture-only&code=fixture-only#fixture-only';
    expect(redirectSystemPath({ path: callback, initial })).toBe('/');
    expect(parseDeepLinkDestination(callback)).toBeNull();
  }
);
test.each([
  'masarifi:///sso-callback?code=fixture-only',
  '/sso-callback?code=fixture-only'
])('sanitizes alternate callback path %s', (path) => {
  expect(redirectSystemPath({ path, initial: false })).toBe('/');
});
test.each([
  'masarifi://reports',
  'masarifi://tracking',
  '/accounts',
  'https://example.test/sso-callback'
])('preserves unrelated link %s', (path) => {
  expect(redirectSystemPath({ path, initial: true })).toBe(path);
});

test('the installed Router linking boundary sanitizes both cold and live callbacks before navigation', async () => {
  const callback = 'masarifi://sso-callback?code=fixture-only';
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(callback);
  let receive!: (event: { url: string }) => void;
  jest
    .spyOn(Linking, 'addEventListener')
    .mockImplementation((_event, listener) => {
      receive = listener;
      return { remove: () => {} } as never;
    });
  const context = Object.assign(() => ({ redirectSystemPath }), {
    keys: () => ['./+native-intent.tsx'],
    resolve: () => '',
    id: 'callback-test'
  });
  const routes: RouteNode = {
    type: 'layout',
    route: '',
    contextKey: './_layout.tsx',
    loadRoute: () => ({ default: () => null }),
    dynamic: null,
    children: [
      {
        type: 'route',
        route: 'index',
        contextKey: './index.tsx',
        loadRoute: () => ({ default: () => null }),
        dynamic: null,
        children: []
      }
    ]
  };
  const config = getLinkingConfig(
    routes,
    context,
    () => ({ segments: [] }) as never,
    { metaOnly: true, skipGenerated: false, sitemap: false, notFound: false }
  );
  const destinations: string[] = [];
  const stop = config.subscribe!((path) => destinations.push(path));
  try {
    expect(await config.getInitialURL!()).toBe('/');
    receive({ url: callback });
    await Promise.resolve();
    expect(destinations).toEqual(['/']);
  } finally {
    stop?.();
    jest.restoreAllMocks();
  }
});
