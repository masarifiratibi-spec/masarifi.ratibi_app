import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

const require = createRequire(import.meta.url);
const mobileRoot = fileURLToPath(new URL('..', import.meta.url));
const cliPath = require.resolve('@expo/cli/package.json', {
  paths: [require.resolve('expo/package.json')]
});
const prebuildPath = require.resolve('@expo/prebuild-config', {
  paths: [cliPath]
});
const { setIconAsync } = require(
  path.join(path.dirname(prebuildPath), 'plugins/icons/withAndroidIcons.js')
);

export async function checkNativeBranding(
  nativeRoot = path.join(mobileRoot, 'android')
) {
  const { expo } = JSON.parse(
    await fs.readFile(path.join(mobileRoot, 'app.json'), 'utf8')
  );
  const adaptive = expo.android.adaptiveIcon;
  const cacheRoot = path.join(mobileRoot, '.expo', 'native-branding-check');
  await fs.mkdir(cacheRoot, { recursive: true });
  const expectedRoot = await fs.mkdtemp(path.join(cacheRoot, 'expected-'));
  await setIconAsync(expectedRoot, {
    icon: path.resolve(
      mobileRoot,
      adaptive?.foregroundImage ?? expo.android.icon ?? expo.icon
    ),
    backgroundColor: adaptive?.backgroundColor,
    backgroundImage:
      adaptive?.backgroundImage &&
      path.resolve(mobileRoot, adaptive.backgroundImage),
    monochromeImage:
      adaptive?.monochromeImage &&
      path.resolve(mobileRoot, adaptive.monochromeImage),
    isAdaptive: Boolean(adaptive)
  });

  const expectedRes = path.join(expectedRoot, 'android/app/src/main/res');
  const manifest = await fs.readFile(
    path.join(nativeRoot, 'app/src/main/AndroidManifest.xml'),
    'utf8'
  );
  assert.match(
    manifest,
    /android:icon="@mipmap\/ic_launcher"/u,
    'Android manifest must use the verified launcher icon.'
  );
  let checked = 0;
  for (const folder of await fs.readdir(expectedRes)) {
    for (const file of await fs.readdir(path.join(expectedRes, folder))) {
      const relative = path.join('app/src/main/res', folder, file);
      const actual = await fs.readFile(path.join(nativeRoot, relative));
      const expected = await fs.readFile(path.join(expectedRes, folder, file));
      assert.ok(
        actual.equals(expected),
        `Stale Android branding: ${relative}. Run Expo prebuild before copying native sources.`
      );
      checked++;
    }
  }
  const strings = await fs.readFile(
    path.join(nativeRoot, 'app/src/main/res/values/strings.xml'),
    'utf8'
  );
  assert.equal(
    strings.match(/<string name="app_name">([^<]+)<\/string>/u)?.[1],
    expo.name,
    'Stale Android application name. Run Expo prebuild.'
  );
  const colors = await fs.readFile(
    path.join(nativeRoot, 'app/src/main/res/values/colors.xml'),
    'utf8'
  );
  if (adaptive?.backgroundColor)
    assert.equal(
      colors
        .match(/<color name="iconBackground">([^<]+)<\/color>/u)?.[1]
        ?.toLowerCase(),
      adaptive.backgroundColor.toLowerCase(),
      'Stale adaptive icon background. Run Expo prebuild.'
    );
  return {
    nativeRoot,
    iconResourcesChecked: checked,
    name: expo.name,
    brandingMatchesCurrentConfig: true
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(JSON.stringify(await checkNativeBranding(process.argv[2])));
}
