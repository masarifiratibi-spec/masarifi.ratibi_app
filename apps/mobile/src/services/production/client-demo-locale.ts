// Production has no demo seeding or demo identity transitions.
export async function synchronizeClientDemoLocale(): Promise<boolean> {
  return false;
}
