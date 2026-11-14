const mockKeywordsLoaded = jest.fn();
jest.mock('expo-notifications', () => ({}));
jest.mock('@/config/demo-mode', () => ({
  ...jest.requireActual('@/config/demo-mode'),
  isFixtureModeEnabled: () => false
}));
jest.mock('@/services/mocks/default-keywords', () => {
  mockKeywordsLoaded();
  return { defaultKeywordRules: [] };
});

it('creates shell storage without generating unused fallback keywords', () => {
  const { createAppShellStorage } = jest.requireActual<
    typeof import('./app-shell-storage')
  >('./app-shell-storage');
  expect(createAppShellStorage().metadata.capability).toBe('app-shell.storage');
  expect(mockKeywordsLoaded).not.toHaveBeenCalled();
});

it('discovers the keyword onboarding route without generating its initial form values', () => {
  jest.requireActual('../../app/(onboarding)/tracking-keywords');
  expect(mockKeywordsLoaded).not.toHaveBeenCalled();
});
