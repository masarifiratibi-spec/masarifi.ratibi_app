export type PlatformPath = 'android' | 'ios' | 'conservative';

export interface PlatformPathInput {
  os: string;
  smsAvailable: boolean;
}

export function resolvePlatformPath(
  input: PlatformPathInput,
  _resume?: { previousPath?: PlatformPath }
): PlatformPath {
  if (input.os === 'android' && input.smsAvailable) return 'android';
  if (input.os === 'ios') return 'ios';
  return 'conservative';
}
