import Constants from 'expo-constants';
import * as Application from 'expo-application';

export type InstalledApplication = {
  version: string | null;
  versionCode: number | null;
};

export function installedApplication(): InstalledApplication {
  const nativeBuild = Application.nativeBuildVersion;
  const code =
    typeof nativeBuild === 'string' && /^[1-9]\d{0,9}$/.test(nativeBuild)
      ? Number(nativeBuild)
      : null;
  return {
    version:
      Application.nativeApplicationVersion ??
      Constants.expoConfig?.version ??
      null,
    versionCode:
      Number.isSafeInteger(code) && code! > 0 && code! <= 2_100_000_000
        ? code!
        : null
  };
}

export function registeredApplicationVersion(): string | null {
  const installed = installedApplication();
  if (!installed.version) return null;
  const registered =
    installed.versionCode === null
      ? installed.version
      : `${installed.version}+${installed.versionCode}`;
  return registered.length <= 32 ? registered : installed.version;
}
