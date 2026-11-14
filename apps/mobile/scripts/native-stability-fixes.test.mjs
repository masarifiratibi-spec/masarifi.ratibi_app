import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const mobile = fileURLToPath(new URL('..', import.meta.url));
const sqlitePath = 'android/src/main/java/expo/modules/sqlite/SQLiteModule.kt';
const screenPaths = [
  'android/src/main/cpp/NativeProxy.cpp',
  'android/src/main/cpp/NativeProxy.h',
  'cpp/RNSScreenRemovalListener.cpp',
  'cpp/RNSScreenRemovalListener.h'
];
const symbolPaths = ['build/SymbolView.js', 'src/SymbolView.tsx'];

function pristineSymbol(path) {
  return readFileSync(join(mobile, 'node_modules/expo-symbols', path), 'utf8')
    .replace(' allowFontScaling={false}', '');
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'masarifi-native-stability-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.startsWith(join(tmpdir(), 'masarifi-native-stability-')));
    rmSync(root, { recursive: true });
  });
  const sqlite = join(root, 'node_modules/expo-sqlite');
  const screens = join(root, 'node_modules/react-native-screens');
  const symbols = join(root, 'node_modules/expo-symbols');
  for (const path of symbolPaths) {
    mkdirSync(dirname(join(symbols, path)), { recursive: true });
    writeFileSync(join(symbols, path), pristineSymbol(path));
  }
  writeFileSync(join(symbols, 'package.json'), '{"version":"55.0.9"}');
  mkdirSync(dirname(join(sqlite, sqlitePath)), { recursive: true });
  cpSync(
    join(mobile, 'vendor/expo-sqlite-cleanup-fix/pristine/SQLiteModule.kt'),
    join(sqlite, sqlitePath)
  );
  cpSync(
    join(mobile, 'vendor/react-native-screens-fabric-fix/pristine'),
    screens,
    { recursive: true }
  );
  writeFileSync(join(sqlite, 'package.json'), '{"version":"55.0.20"}');
  writeFileSync(join(screens, 'package.json'), '{"version":"4.23.0"}');
  cpSync(join(mobile, 'vendor'), join(root, 'vendor'), { recursive: true });
  mkdirSync(join(root, 'scripts'));
  for (const name of [
    'native-stability-fixes.mjs',
    'sqlite-cleanup-fix.mjs',
    'screens-fabric-fix.mjs',
    'symbol-font-scale-fix.mjs'
  ]) {
    if (existsSync(join(mobile, 'scripts', name)))
      cpSync(join(mobile, 'scripts', name), join(root, 'scripts', name));
  }
  cpSync(join(mobile, 'package.json'), join(root, 'package.json'));
  mkdirSync(join(root, 'android'));
  writeFileSync(
    join(root, 'android/build.gradle'),
    '// disposable Gradle fixture\n'
  );
  return { root, sqlite, screens, symbols };
}

function cli(root, operation) {
  return spawnSync(
    process.execPath,
    [join(root, 'scripts/native-stability-fixes.mjs'), operation],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      env: {
        ...process.env,
        MASARIFI_APP_VARIANT: '',
        EXPO_PUBLIC_APP_VARIANT: '',
        EAS_BUILD_PROFILE: 'staging-client'
      }
    }
  );
}
function assertPatched({ sqlite, screens, symbols }) {
  for (const path of symbolPaths) {
    assert.match(readFileSync(join(symbols, path), 'utf8'), /<Text allowFontScaling=\{false\}/);
  }
  assert.match(
    readFileSync(join(sqlite, sqlitePath), 'utf8'),
    /cachedDatabases\.toList\(\)/
  );
  for (const path of screenPaths)
    assert.equal(
      readFileSync(join(screens, path), 'utf8').replace(/\r\n/g, '\n'),
      readFileSync(
        join(mobile, 'vendor/react-native-screens-fabric-fix/patched', path),
        'utf8'
      ).replace(/\r\n/g, '\n')
    );
}

test('the build check refuses unpatched icon glyphs without rewriting them', (t) => {
  const f = fixture(t);
  assert.equal(cli(f.root, '--apply').status, 0);
  const path = join(f.symbols, symbolPaths[0]);
  const before = pristineSymbol(symbolPaths[0]);
  writeFileSync(path, before);
  const checked = cli(f.root, '--check');
  assert.notEqual(checked.status, 0);
  assert.match(checked.stderr, /SYMBOL_FONT_SCALE_FIX_NOT_APPLIED/);
  assert.equal(readFileSync(path, 'utf8'), before);
});

test('icon preparation refuses changed upstream source before changing either symbol file', (t) => {
  const f = fixture(t);
  const path = join(f.symbols, symbolPaths[1]);
  writeFileSync(path, pristineSymbol(symbolPaths[1]) + '\n// upstream change\n');
  const before = symbolPaths.map(path => readFileSync(join(f.symbols, path), 'utf8'));
  const applied = cli(f.root, '--apply');
  assert.notEqual(applied.status, 0);
  assert.match(applied.stderr, /SYMBOL_SOURCE_MISMATCH/);
  assert.deepEqual(symbolPaths.map(path => readFileSync(join(f.symbols, path), 'utf8')), before);
});

test('ordinary postinstall patches a clean dependency tree and repeated preparation preserves it', (t) => {
  const f = fixture(t);
  const scripts = JSON.parse(
    readFileSync(join(f.root, 'package.json'))
  ).scripts;
  assert.ok(
    scripts.postinstall,
    'ordinary installation must prepare native dependencies'
  );
  const run = spawnSync(scripts.postinstall, {
    cwd: f.root,
    shell: true,
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
    env: {
      ...process.env,
      MASARIFI_APP_VARIANT: '',
      EXPO_PUBLIC_APP_VARIANT: '',
      EAS_BUILD_PROFILE: 'staging-client'
    }
  });
  assert.equal(run.status, 0, run.stderr);
  assertPatched(f);
  assert.equal(cli(f.root, '--apply').status, 0);
  assert.equal(cli(f.root, '--check').status, 0);
});

test('Android prebuild prepares dependencies when install scripts were skipped and keeps one Gradle guard', async (t) => {
  const f = fixture(t);
  const entry = JSON.parse(readFileSync(join(mobile, 'app.json'))).expo.plugins.find(
    (item) => item === './plugins/with-native-stability-fixes.cjs'
  );
  assert.ok(entry, 'ordinary Expo builds must register native preparation');
  const { compileModsAsync, withPlugins } = require('expo/config-plugins');
  const config = () =>
    withPlugins({
      name: 'Disposable ordinary fixture',
      slug: 'native-stability-fixture',
      _internal: { projectRoot: mobile },
      android: { package: 'com.masarifi.mobile' }
    }, [entry]);
  await compileModsAsync(config(), {
    projectRoot: f.root,
    platforms: ['android'],
    introspect: false
  });
  assertPatched(f);
  const before = readFileSync(join(f.root, 'android/build.gradle'), 'utf8');
  await compileModsAsync(config(), {
    projectRoot: f.root,
    platforms: ['android'],
    introspect: false
  });
  assert.equal(
    readFileSync(join(f.root, 'android/build.gradle'), 'utf8'),
    before
  );
  assert.match(before, /native-stability-fixes\.mjs/);
  assert.match(before, /--check/);
  writeFileSync(join(f.root, 'android/build.gradle'), before.replace(/\n/g, '\r\n'));
  await compileModsAsync(config(), { projectRoot: f.root, platforms: ['android'], introspect: false });
  assert.equal(readFileSync(join(f.root, 'android/build.gradle'), 'utf8').replace(/\r\n/g, '\n'), before);
});

for (const changed of ['sqlite', 'screens']) {
  test(`the build check refuses an unpatched ${changed} dependency without rewriting it`, (t) => {
    const f = fixture(t);
    assert.equal(cli(f.root, '--apply').status, 0);
    const path =
      changed === 'sqlite'
        ? join(f.sqlite, sqlitePath)
        : join(f.screens, screenPaths[0]);
    const pristine =
      changed === 'sqlite'
        ? join(
            mobile,
            'vendor/expo-sqlite-cleanup-fix/pristine/SQLiteModule.kt'
          )
        : join(
            mobile,
            'vendor/react-native-screens-fabric-fix/pristine',
            screenPaths[0]
          );
    cpSync(pristine, path);
    const before = readFileSync(path, 'utf8');
    const checked = cli(f.root, '--check');
    assert.notEqual(checked.status, 0);
    assert.match(
      checked.stderr,
      changed === 'sqlite'
        ? /SQLITE_CLEANUP_FIX_NOT_APPLIED/
        : /FABRIC_FIX_NOT_APPLIED/
    );
    assert.equal(readFileSync(path, 'utf8'), before);
  });
}
