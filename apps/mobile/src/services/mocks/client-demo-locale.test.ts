const mockSeederLoaded = jest.fn();
const mockSeed = jest.fn().mockResolvedValue(true);

jest.mock('@/config/demo-mode', () => ({ isDemoModeEnabled: () => false }));
jest.mock('@/storage/client-demo-seeder', () => {
  mockSeederLoaded();
  return { seedClientDemoData: mockSeed };
});

it('does not initialize demo seeds when live startup checks locale', async () => {
  const { synchronizeClientDemoLocale } = jest.requireActual<typeof import('./client-demo-locale')>('./client-demo-locale');
  expect(await synchronizeClientDemoLocale('ar')).toBe(false);
  expect(mockSeederLoaded).not.toHaveBeenCalled();
  expect(mockSeed).not.toHaveBeenCalled();
});
