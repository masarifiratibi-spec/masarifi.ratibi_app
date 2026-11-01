import { redirectSystemPath } from '@app/+native-intent';
import { parseDeepLinkDestination } from '@/features/shell/deep-link-controller';
import { Linking, Platform } from 'react-native';
import { getLinkingConfig } from 'expo-router/build/getLinkingConfig';
import type { RouteNode } from 'expo-router/build/Route';
import { extractExpoPathFromURL } from 'expo-router/build/fork/extractPathFromURL';

test.each([
  ['masarifi', true],
  ['masarifi', false],
  ['masarifi-dev', true],
  ['masarifi-dev', false]
] as const)(
  'routes the %s native callback (initial=%s) to clean bootstrap without copying its parameters',
  (scheme, initial) => {
    const callback =
      `${scheme}://sso-callback?rotating_token_nonce=fixture-only&code=fixture-only#fixture-only`;
    expect(redirectSystemPath({ path: callback, initial })).toBe('/');
    expect(parseDeepLinkDestination(callback)).toBeNull();
  }
);
test.each([
  'masarifi:///sso-callback?code=fixture-only',
  'masarifi-dev:///sso-callback?code=fixture-only',
  '/sso-callback?code=fixture-only'
])('sanitizes alternate callback path %s', (path) => {
  expect(redirectSystemPath({ path, initial: false })).toBe('/');
});
test.each([
  'masarifi://reports',
  'masarifi://tracking',
  '/accounts',
  'https://example.test/sso-callback',
  'masarifi://reports?label=%D9%85%D8%B5%D8%B1%D9%88%D9%81'
])('preserves unrelated link %s', (path) => {
  expect(redirectSystemPath({ path, initial: true })).toBe(path);
});

// Cases: raw malformed escapes, malformed UTF-8, nested values, relative/web links.
test.each([
  'masarifi://reports?label=%',
  'masarifi://reports?label=%C0%AF',
  'masarifi://reports?label=%25C0%25AF',
  '/reports?label=%C0%AF',
  'https://example.test/reports?label=%C0%AF',
  'masarifi://reports/%C0%AF'
])('routes malformed link to clean bootstrap: %s', (path) => {
  expect(redirectSystemPath({ path, initial: true })).toBe('/');
  expect(redirectSystemPath({ path, initial: false })).toBe('/');
});

test.each([
  ['masarifi://sso-callback?code=fixture-only', '/'],
  ['masarifi-dev://sso-callback?code=fixture-only', '/'],
  ['masarifi-dev://sso-callback?code=%C0%AF', '/'],
  ['masarifi://sso-callback?code=%C0%AF', '/'],
  ['masarifi://reports?label=%25C0%25AF', '/'],
  [
    'masarifi://reports?label=%D9%85%D8%B5%D8%B1%D9%88%D9%81',
    'masarifi://reports?label=%D9%85%D8%B5%D8%B1%D9%88%D9%81'
  ],
  ['masarifi://reports?label=100%2525', 'masarifi://reports?label=100%2525'],
  [
    'masarifi://reports?label=%2525C0%2525AF',
    'masarifi://reports?label=%2525C0%2525AF'
  ],
  ['masarifi://reports?%25C0%25AF=label', 'masarifi://reports?%25C0%25AF=label']
])(
  'the installed Router sanitizes cold/live link %s before navigation',
  async (callback, destination) => {
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
          route: 'reports',
          contextKey: './reports.tsx',
          loadRoute: () => ({ default: () => null }),
          dynamic: null,
          children: []
        },
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
      const cold = await config.getInitialURL!();
      expect(cold).toBe(destination);
      receive({ url: callback });
      await Promise.resolve();
      expect(destinations).toEqual([destination]);
      const coldState = config.getStateFromPath!(
        extractExpoPathFromURL([], cold!),
        config.config
      );
      const liveState = config.getStateFromPath!(
        extractExpoPathFromURL([], destinations[0]),
        config.config
      );
      expect(liveState).toEqual(coldState);
      expect(coldState).toBeDefined();
      if (destination.includes('%D9')) {
        expect(JSON.stringify(coldState)).toContain('مصروف');
      }
      if (destination.includes('100%2525')) {
        expect(JSON.stringify(coldState)).toContain('100%');
      }
      if (destination.includes('label=%2525C0')) {
        expect(JSON.stringify(coldState)).toContain('"label":"��"');
      }
      if (destination.includes('?%25C0')) {
        expect(JSON.stringify(coldState)).toContain('"��":"label"');
      }
    } finally {
      stop?.();
      jest.restoreAllMocks();
    }
  }
);
