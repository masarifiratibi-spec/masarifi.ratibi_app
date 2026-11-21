import { AppState, Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';

// Android's RN networking events can wait for foreground resume. Install before
// Clerk and service factories capture fetch; keep their fresh-auth checks intact.
const installed = Symbol.for('masarifi.android.background-fetch.v1');
type InstalledFetch = typeof globalThis.fetch & { [installed]?: true };

if (
  Platform.OS === 'android' &&
  !(globalThis.fetch as InstalledFetch)[installed]
) {
  const foregroundFetch = globalThis.fetch;
  const nativeFetch = expoFetch as typeof globalThis.fetch;
  const request: InstalledFetch = (input, options) =>
    Platform.OS === 'android' && AppState.currentState !== 'active'
      ? nativeFetch(input, options)
      : foregroundFetch(input, options);
  Object.defineProperty(request, installed, { value: true });
  globalThis.fetch = request;
}
