import {
  androidUpdatePolicy,
  needsAndroidUpdate,
  sameAndroidRelease,
} from '../../../src/platform/meta/android-update-policy';

const release = { version: '1.0.1', versionCode: 140 };

it('publishes nothing until a complete release is explicitly available', () => {
  expect(androidUpdatePolicy({})).toMatchObject({ enabled: false, release: null });
  expect(androidUpdatePolicy({ published: false, ...release })).toMatchObject({ enabled: false });
  expect(androidUpdatePolicy({ published: true, version: release.version })).toMatchObject({
    enabled: false,
  });
  expect(
    androidUpdatePolicy({ published: true, version: 'invalid', versionCode: 140 }),
  ).toMatchObject({ enabled: false });
  expect(androidUpdatePolicy({ published: true, ...release })).toEqual({
    schemaVersion: 1,
    enabled: true,
    release,
    storeUrl: 'https://play.google.com/store/apps/details?id=com.masarifi.mobile',
  });
});

it.each([
  ['1.0.0+139', true],
  ['1.0.1+139', true],
  ['1.0.1+140', false],
  ['1.0.1+141', false],
  ['1.0.2+141', false],
  ['1.0.0', true],
  ['1.0.1', false],
  ['1.0.2', false],
  ['broken', false],
  ['', false],
  ['1.0.1+0', false],
  ['1.0.1+99999999999999999999', false],
])('targets registered Android version %s truthfully', (version, expected) => {
  expect(needsAndroidUpdate(version, release)).toBe(expected);
});

it('withdrawal or replacement invalidates queued announcements', () => {
  expect(sameAndroidRelease(androidUpdatePolicy({ published: true, ...release }), release)).toBe(
    true,
  );
  expect(sameAndroidRelease(androidUpdatePolicy({ published: false, ...release }), release)).toBe(
    false,
  );
  expect(
    sameAndroidRelease(androidUpdatePolicy({ published: true, ...release }), {
      ...release,
      versionCode: 139,
    }),
  ).toBe(false);
});
