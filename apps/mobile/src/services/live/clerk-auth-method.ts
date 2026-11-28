import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { authMethods, type AuthenticationMethod } from '@/domain/app-shell';

type SessionIdentity = { id: string };
const methodSchema = z.object({
  sessionId: z.string(),
  method: z.enum(authMethods)
});
const methodKey = (session: SessionIdentity) =>
  `masarifi.clerk.auth-method.${session.id}`;

export async function restoreClerkAuthMethod(
  session: SessionIdentity
): Promise<AuthenticationMethod> {
  // This is descriptive metadata, never an authentication credential. If its
  // storage is unavailable, retain the verified SDK identity without guessing a provider.
  let serialized: string | null;
  try {
    serialized = await SecureStore.getItemAsync(methodKey(session));
  } catch {
    return 'unknown';
  }
  // Existing releases only exposed Google and have no provider-method record.
  if (!serialized) return 'google';
  let stored: unknown;
  try {
    stored = JSON.parse(serialized);
  } catch (error) {
    if (error instanceof SyntaxError) return 'unknown';
    throw error;
  }
  const parsed = methodSchema.safeParse(stored);
  return parsed.success && parsed.data.sessionId === session.id
    ? parsed.data.method
    : 'unknown';
}

export function saveClerkAuthMethod(
  session: SessionIdentity & { method: (typeof authMethods)[number] }
): Promise<void> {
  return SecureStore.setItemAsync(
    methodKey(session),
    // Clerk session IDs are unique across owners. Persist before activation so
    // a failed write cannot leave a newly active session without its method.
    JSON.stringify({ sessionId: session.id, method: session.method })
  );
}

// Cleanup of this provider label is best effort after the SDK session is gone.
// A failed label deletion must not turn completed sign-out into a failed logout.
export async function clearClerkAuthMethod(
  session: SessionIdentity
): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(methodKey(session));
    return true;
  } catch {
    return false;
  }
}
