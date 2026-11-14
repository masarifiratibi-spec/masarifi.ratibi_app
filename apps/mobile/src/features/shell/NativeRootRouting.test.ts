import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Linking, Platform } from 'react-native';
import { getRoutes } from 'expo-router/build/getRoutes';
import { getLinkingConfig } from 'expo-router/build/getLinkingConfig';
import { extractExpoPathFromURL } from 'expo-router/build/fork/extractPathFromURL';
import { getRouteInfoFromState } from 'expo-router/build/global-state/routeInfo';

import { redirectSystemPath } from '@app/+native-intent';

function appRouteKeys(directory: string, root = directory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = join(directory, entry.name);
    return entry.isDirectory()
      ? appRouteKeys(filename, root)
      : [`./${relative(root, filename).replace(/\\/gu, '/')}`];
  });
}

test.each([
  ...['masarifi', 'masarifi-dev', 'masarifi-benchmark'].flatMap((scheme) =>
    [':///', ':///index', '://index', '://app/index'].map(
      (suffix) => `${scheme}${suffix}`
    )
  ),
  '/index'
])(
  'the checked-in route tree accepts root alias %s on cold and live native entry',
  async (url) => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
    let receive!: (event: { url: string }) => void;
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_event, listener) => {
        receive = listener;
        return { remove: () => {} } as never;
      });
    // Keep route discovery and matching real without mounting each screen's services.
    const context = Object.assign(
      (key: string) =>
        key === './+native-intent.tsx'
          ? { redirectSystemPath }
          : { default: () => null },
      {
        keys: () => appRouteKeys(resolve(__dirname, '../../../app')),
        resolve: () => '',
        id: 'checked-in-native-root'
      }
    );
    const routes = getRoutes(context, {
      platform: 'android',
      skipGenerated: true,
      ignoreEntryPoints: true
    });
    expect(routes).not.toBeNull();
    const config = getLinkingConfig(
      routes!,
      context,
      () => ({ segments: [] }) as never,
      { metaOnly: true, skipGenerated: false, sitemap: true, notFound: true }
    );
    const destinations: string[] = [];
    const stop = config.subscribe!((path) => destinations.push(path));
    try {
      const initial = await config.getInitialURL!();
      receive({ url });
      await Promise.resolve();
      expect(destinations).toHaveLength(1);
      for (const destination of [initial, destinations[0]]) {
        const state = config.getStateFromPath!(
          extractExpoPathFromURL([], destination!),
          config.config
        );
        expect(getRouteInfoFromState(state).segments).toEqual([]);
        expect(state?.routes[0].name).toBe('__root');
        expect(state?.routes[0].state?.routes[0].name).toBe('index');
      }
    } finally {
      stop?.();
      jest.restoreAllMocks();
    }
  }
);
