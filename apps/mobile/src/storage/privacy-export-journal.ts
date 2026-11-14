import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
const journalSchema = z
  .object({
    operationId: z.string().uuid(),
    requestId: z.string().min(1).optional()
  })
  .strict();
export type PrivacyExportJournal = z.infer<typeof journalSchema>;
const ownerKey = (owner: string) => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(owner))
    throw new Error('EXPORT_OWNER_INVALID');
  return `masarifi.export.${owner}`;
};
// Only replay/request identifiers are retained; never signed URLs or exported financial data.
export async function loadPrivacyExportJournal(
  owner: string
): Promise<PrivacyExportJournal | null> {
  const saved = await AsyncStorage.getItem(ownerKey(owner));
  return saved ? journalSchema.parse(JSON.parse(saved)) : null;
}
export async function savePrivacyExportJournal(
  owner: string,
  journal: PrivacyExportJournal
): Promise<void> {
  await AsyncStorage.setItem(
    ownerKey(owner),
    JSON.stringify(journalSchema.parse(journal))
  );
}
export async function clearPrivacyExportJournal(owner: string): Promise<void> {
  await AsyncStorage.removeItem(ownerKey(owner));
}
