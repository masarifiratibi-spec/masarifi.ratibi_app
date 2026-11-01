/* global __dirname */
/* eslint-disable @typescript-eslint/no-var-requires -- Expo config plugins use CommonJS. */
const {
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod
} = require('expo/config-plugins');
const { copyFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const policyLine = 'apply from: "release-safety.gradle"';
function installReleasePolicy(contents) {
  return contents.includes(policyLine)
    ? contents
    : contents.trimEnd() + '\n' + policyLine + '\n';
}
async function copyReleasePolicy(platformProjectRoot) {
  for (const name of ['release-safety.gradle', 'release-rules.pro']) {
    await copyFile(
      path.join(__dirname, name),
      path.join(platformProjectRoot, 'app', name)
    );
  }
  const releaseDirectory = path.join(
    platformProjectRoot,
    'app',
    'src',
    'release'
  );
  await mkdir(releaseDirectory, { recursive: true });
  await copyFile(
    path.join(__dirname, 'release-AndroidManifest.xml'),
    path.join(releaseDirectory, 'AndroidManifest.xml')
  );
}
module.exports = function withReleaseSafety(config) {
  config = withProjectBuildGradle(config, (mod) => {
    const dependency = "classpath('com.android.tools:r8:8.13.19')";
    if (!mod.modResults.contents.includes(dependency)) {
      if (
        !mod.modResults.contents.includes(
          "classpath('com.android.tools.build:gradle')"
        )
      )
        throw new Error('ANDROID_BUILD_PLUGIN_MARKER_MISSING');
      mod.modResults.contents = mod.modResults.contents.replace(
        "classpath('com.android.tools.build:gradle')",
        dependency + "\n    classpath('com.android.tools.build:gradle')"
      );
    }
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy')
      throw new Error('RELEASE_POLICY_REQUIRES_GROOVY');
    mod.modResults.contents = installReleasePolicy(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      await copyReleasePolicy(mod.modRequest.platformProjectRoot);
      return mod;
    }
  ]);
};
module.exports.installReleasePolicy = installReleasePolicy;
module.exports.copyReleasePolicy = copyReleasePolicy;
