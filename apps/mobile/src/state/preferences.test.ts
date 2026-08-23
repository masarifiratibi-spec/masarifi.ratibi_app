import { buildPreferences } from '@/domain/foundation';
import { loadPreferences, savePreferences } from '@/storage/secure-preferences';
import { usePreferenceStore } from './preferences';

jest.mock('@/storage/secure-preferences', () => ({
  loadPreferences: jest.fn(),
  savePreferences: jest.fn().mockResolvedValue(undefined)
}));

const mockLoadPreferences = jest.mocked(loadPreferences);
const mockSavePreferences = jest.mocked(savePreferences);

beforeEach(() => {
  jest.clearAllMocks();
  usePreferenceStore.setState({ ...buildPreferences({}), hydrated: false });
});

it.each(['dark', 'system'] as const)(
  'replaces and persists a stored %s theme during hydration',
  async (theme) => {
    mockLoadPreferences.mockResolvedValue(buildPreferences({ theme }));

    await usePreferenceStore.getState().hydrate();

    expect(usePreferenceStore.getState()).toMatchObject({
      hydrated: true,
      theme: 'light'
    });
    expect(mockSavePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'light' })
    );
  }
);

it('does not rewrite an already-light stored theme', async () => {
  mockLoadPreferences.mockResolvedValue(buildPreferences({ theme: 'light' }));

  await usePreferenceStore.getState().hydrate();

  expect(usePreferenceStore.getState().theme).toBe('light');
  expect(mockSavePreferences).not.toHaveBeenCalled();
});

it('finishes hydration with defaults when persisted preferences cannot be read', async () => {
  mockLoadPreferences.mockRejectedValue(new Error('storage unavailable'));

  await expect(
    usePreferenceStore.getState().hydrate()
  ).resolves.toBeUndefined();

  expect(usePreferenceStore.getState()).toMatchObject({
    hydrated: true,
    locale: 'ar',
    theme: 'light',
    hideBalances: false
  });
});

it('prevents transient theme changes while dark mode is disabled', () => {
  usePreferenceStore.getState().setTheme('dark');

  expect(usePreferenceStore.getState().theme).toBe('light');
});
