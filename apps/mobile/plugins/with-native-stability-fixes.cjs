/* eslint-disable @typescript-eslint/no-var-requires -- Expo loads config plugins as CommonJS. */
const {
  withDangerousMod,
  withProjectBuildGradle
} = require('expo/config-plugins');

const marker = '// masarifi-native-stability-verification';
const verification = `
${marker}
def masarifiMobileRoot = findProperty('masarifi.mobileRoot') ?: rootDir.parentFile
def masarifiNativeFixes = providers.exec {
    workingDir(masarifiMobileRoot)
    commandLine('node', new File(masarifiMobileRoot, 'scripts/native-stability-fixes.mjs').absolutePath, '--check')
    ignoreExitValue = true
}
if (masarifiNativeFixes.result.get().exitValue != 0) {
    throw new GradleException('Native stability verification failed. Run npm run prepare:android.\\n' + masarifiNativeFixes.standardError.asText.get())
}
// end-masarifi-native-stability-verification
`;

module.exports = function withNativeStabilityFixes(config) {
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy')
      throw new Error('NATIVE_STABILITY_REQUIRES_GROOVY_BUILD');
    mod.modResults.contents =
      mod.modResults.contents.replace(
        /\r?\n\/\/ masarifi-native-stability-verification\r?\n[\s\S]*?\r?\n\/\/ end-masarifi-native-stability-verification(?:\r?\n)?/g,
        ''
      ) + verification;
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const { prepareNativeStabilityFixes } =
        await import('../scripts/native-stability-fixes.mjs');
      prepareNativeStabilityFixes(mod.modRequest.projectRoot);
      return mod;
    }
  ]);
};
