import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { authMethods, type AuthenticationMethod } from '@/domain/app-shell';

type SessionIdentity = { id: string; userId: string };
const methodSchema = z.object({
  ownerId: z.string(),
  method: z.enum(authMethods)
});
const methodKey = (session: SessionIdentity) =>
  `masarifi.clerk.auth-method.${session.id}`;

export async function restoreClerkAuthMethod(
  session: SessionIdentity
): Promise<AuthenticationMethod> {
  const serialized = await SecureStore.getItemAsync(methodKey(session));
  // Existing releases only exposed Google and have no provider-method record.
  if (!serialized) return 'google';
  let stored: unknown;
  try {
    stored = JSON.parse(serialized);
  } catch (error) {
    if (error instanceof SyntaxError) return 'google';
    throw error;
  }
  const parsed = methodSchema.safeParse(stored);
  return parsed.success && parsed.data.ownerId === session.userId
    ? parsed.data.method
    : 'google';
}

export function saveClerkAuthMethod(
  session: SessionIdentity & { method: AuthenticationMethod }
): Promise<void> {
  return SecureStore.setItemAsync(
    methodKey(session),
    JSON.stringify({ ownerId: session.userId, method: session.method })
  );
}

export function clearClerkAuthMethod(session: SessionIdentity): Promise<void> {
  return SecureStore.deleteItemAsync(methodKey(session));
}
