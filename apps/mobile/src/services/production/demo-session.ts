// Production bundles contain no simulated authenticated identity or onboarding state.
export function createClientDemoSession(): never {
  throw new Error('DEMO_SESSION_UNAVAILABLE');
}
export function createCompletedDemoOnboarding(): never {
  throw new Error('DEMO_SESSION_UNAVAILABLE');
}
