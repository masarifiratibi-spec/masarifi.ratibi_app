export type ExternalSensitiveSurface =
  | 'lock-screen'
  | 'app-switcher'
  | 'error'
  | 'analytics'
  | 'title';

export function safeExternalSensitiveValue(
  _value: string,
  _surface: ExternalSensitiveSurface
): string {
  return '****';
}
