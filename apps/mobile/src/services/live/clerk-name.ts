export type ClerkNameSource = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function resolvePublicDisplayName(
  savedName: string | null | undefined,
  providerName: string | null,
  genericName: string
): string {
  return savedName?.trim() || providerName?.trim() || genericName;
}

export function resolveClerkDisplayName(
  user: ClerkNameSource | null | undefined
): string | null {
  const fullName = user?.fullName?.trim();
  if (fullName) return fullName;
  const joined = [user?.firstName, user?.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim())
    .join(' ');
  return joined || null;
}
