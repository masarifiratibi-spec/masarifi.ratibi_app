export type AppShellRecoveryAction =
  | 'retry'
  | 'change_method'
  | 'restart'
  | 'wait'
  | 'manual_fallback'
  | 'use_pin';

export interface AppShellMappedError {
  code: string;
  recoveryAction: AppShellRecoveryAction;
}

const mappings: readonly [RegExp, AppShellMappedError][] = [
  [/offline|network/i, { code: 'appShell.error.offline', recoveryAction: 'retry' }],
  [/cancel/i, { code: 'appShell.error.cancelled', recoveryAction: 'change_method' }],
  [/expired|expiry/i, { code: 'appShell.error.expired', recoveryAction: 'restart' }],
  [/rate/i, { code: 'appShell.error.rateLimited', recoveryAction: 'wait' }],
  [
    /permission|denied/i,
    { code: 'appShell.error.permissionDenied', recoveryAction: 'manual_fallback' }
  ],
  [
    /biometric|locked/i,
    { code: 'appShell.error.biometricLocked', recoveryAction: 'use_pin' }
  ],
  [
    /persist|storage/i,
    { code: 'appShell.error.persistenceFailed', recoveryAction: 'retry' }
  ]
];

export function mapAppShellError(error: unknown): AppShellMappedError {
  const message = error instanceof Error ? error.message : String(error);
  return (
    mappings.find(([pattern]) => pattern.test(message))?.[1] ?? {
      code: 'appShell.error.unknown',
      recoveryAction: 'retry'
    }
  );
}
