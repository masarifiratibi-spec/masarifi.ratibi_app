export type SensitiveState = 'masked' | 'revealed';
export type SensitiveEvent = 'authorize' | 'background' | 'app_lock';
export type SensitiveSurface =
  | 'in-app'
  | 'lock-screen'
  | 'app-switcher'
  | 'error'
  | 'analytics';

export function nextSensitiveState(
  state: SensitiveState,
  event: SensitiveEvent,
  surface: SensitiveSurface
): SensitiveState {
  if (surface !== 'in-app') return 'masked';
  if (event === 'authorize') return 'revealed';
  if (event === 'background' || event === 'app_lock') return 'masked';
  return state;
}
