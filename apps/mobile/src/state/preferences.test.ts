import { buildPreferences } from '@/domain/foundation';
import { loadPreferences, savePreferences } from '@/storage/secure-preferences';
import { usePreferenceStore, effectiveReturnRemindersEnabled } from './preferences';
import { resetRuntimeUserData } from '@/storage/runtime-user-data-reset';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';
import { synchronizeClientDemoLocale } from '@/services/mocks/client-demo-locale';

jest.mock('@/storage/secure-preferences', () => ({
  loadPreferences: jest.fn(),
  savePreferences: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('@/services/mocks/client-demo-locale', () => ({
  synchronizeClientDemoLocale: jest.fn(async () => true)
}));

const mockLoadPreferences = jest.mocked(loadPreferences);
const mockSavePreferences = jest.mocked(savePreferences);
const synchronizeDemoLocale = jest.mocked(synchronizeClientDemoLocale);

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_DEMO_MODE;
  jest.clearAllMocks();
  usePreferenceStore.setState({ ...buildPreferences({}), hydrated: false });
});

it('defaults reminders on for every new owner while preserving each explicit choice across switches and reloads', async () => {
  expect(effectiveReturnRemindersEnabled('new-owner')).toBe(true);
  await usePreferenceStore.getState().setReturnRemindersEnabled(false, 'owner-a');
  expect(effectiveReturnRemindersEnabled('owner-a')).toBe(false);
  await resetRuntimeIdentityData({ restoringOwnerId: 'owner-b' });
  expect(effectiveReturnRemindersEnabled('owner-b')).toBe(true);
  expect(effectiveReturnRemindersEnabled('owner-a')).toBe(false);
  const saved = mockSavePreferences.mock.calls.at(-1)![0];
  mockLoadPreferences.mockResolvedValue(saved);
  usePreferenceStore.setState({ ...buildPreferences({}), hydrated: false });
  await usePreferenceStore.getState().hydrate();
  expect(effectiveReturnRemindersEnabled('owner-a')).toBe(false);
  expect(effectiveReturnRemindersEnabled('arbitrary-owner-1000')).toBe(true);
});

it('commits a demo locale switch after its fixtures are relocalized', async () => {
  process.env.EXPO_PUBLIC_DEMO_MODE = '1';
  let finishSync!: () => void;
  synchronizeDemoLocale.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finishSync = () => resolve(true);
    })
  );

  const switchingLocale = usePreferenceStore.getState().setLocale('en');
  expect(usePreferenceStore.getState().locale).toBe('ar');
  finishSync();
  await switchingLocale;

  expect(synchronizeDemoLocale).toHaveBeenCalledWith('en');
  expect(usePreferenceStore.getState()).toMatchObject({
    locale: 'en',
    direction: 'ltr'
  });
});

it('defaults reminder consent off and persists explicit consent without changing capture preferences', async () => {
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false);
  await usePreferenceStore.getState().setReturnRemindersEnabled(true, 'owner-a');
  expect(mockSavePreferences).toHaveBeenLastCalledWith(expect.objectContaining({ returnRemindersEnabled: true, returnRemindersOwnerId: 'owner-a', trackingPersonalization: true }));
});

it('preserves reminder consent for the same owner and withdraws it before an owner handoff', async () => {
  await usePreferenceStore.getState().setReturnRemindersEnabled(true, 'owner-a');
  await resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' });
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(true);
  await resetRuntimeIdentityData({ restoringOwnerId: 'owner-b' });
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false);
});

it('retains explicit guest consent during an ordinary signed-out cold restore', async () => {
  await usePreferenceStore.getState().setReturnRemindersEnabled(true, null);
  await resetRuntimeIdentityData({ kind: 'restore-unavailable' });
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(true);
});

it('does not publish or synchronize reminder opt-in until persistence succeeds', async () => {
  mockSavePreferences.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(usePreferenceStore.getState().setReturnRemindersEnabled(true, 'owner-a')).rejects.toThrow('storage unavailable');
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false);
});

it('withdraws reminder consent even if persisting the opt-out fails', async () => {
  await usePreferenceStore.getState().setReturnRemindersEnabled(true, 'owner-a');
  mockSavePreferences.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(usePreferenceStore.getState().setReturnRemindersEnabled(false, 'owner-a')).rejects.toThrow('storage unavailable');
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false);
});

it('does not publish an old opt-in after owner handoff while storage was pending', async () => {
  let finish!: () => void;
  mockSavePreferences.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  const enabling = usePreferenceStore.getState().setReturnRemindersEnabled(true, 'owner-a');
  await Promise.resolve();
  const handoff = resetRuntimeIdentityData({ restoringOwnerId: 'owner-b' });
  finish();
  await Promise.all([enabling, handoff]);
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false);
  expect(mockSavePreferences).toHaveBeenLastCalledWith(expect.objectContaining({ returnRemindersEnabled: false, returnRemindersOwnerId: null }));
});

it('persists first-launch completion and keeps it through a language switch', async () => {
  await usePreferenceStore.getState().completeFirstLaunchOnboarding();
  await usePreferenceStore.getState().setLocale('en');

  expect(usePreferenceStore.getState()).toMatchObject({
    firstLaunchOnboardingCompleted: true,
    locale: 'en',
    direction: 'ltr'
  });
  expect(mockSavePreferences).toHaveBeenLastCalledWith(
    expect.objectContaining({
      firstLaunchOnboardingCompleted: true,
      locale: 'en'
    })
  );
});

it('does not complete first launch when persistence fails', async () => {
  mockSavePreferences.mockRejectedValueOnce(new Error('storage unavailable'));

  await expect(
    usePreferenceStore.getState().completeFirstLaunchOnboarding()
  ).rejects.toThrow('storage unavailable');

  expect(usePreferenceStore.getState().firstLaunchOnboardingCompleted).toBe(
    false
  );
});

it('keeps the current locale when demo relocalization fails', async () => {
  process.env.EXPO_PUBLIC_DEMO_MODE = '1';
  synchronizeDemoLocale.mockRejectedValueOnce(
    new Error('database unavailable')
  );

  await usePreferenceStore.getState().setLocale('en');

  expect(usePreferenceStore.getState().locale).toBe('ar');
  expect(mockSavePreferences).not.toHaveBeenCalled();
});

it('preserves preference changes made while demo relocalization runs', async () => {
  process.env.EXPO_PUBLIC_DEMO_MODE = '1';
  let finishSync!: () => void;
  synchronizeDemoLocale.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finishSync = () => resolve(true);
    })
  );

  const switchingLocale = usePreferenceStore.getState().setLocale('en');
  usePreferenceStore.getState().toggleHideBalances();
  finishSync();
  await switchingLocale;

  expect(usePreferenceStore.getState()).toMatchObject({
    locale: 'en',
    hideBalances: true
  });
});

it('serializes rapid demo locale changes and commits only the latest', async () => {
  process.env.EXPO_PUBLIC_DEMO_MODE = '1';
  let finishEnglish!: () => void;
  let finishArabic!: () => void;
  synchronizeDemoLocale
    .mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finishEnglish = () => resolve(true);
      })
    )
    .mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finishArabic = () => resolve(true);
      })
    );

  const switchingToEnglish = usePreferenceStore.getState().setLocale('en');
  const switchingBackToArabic = usePreferenceStore.getState().setLocale('ar');
  finishEnglish();
  await switchingToEnglish;
  await Promise.resolve();

  expect(synchronizeDemoLocale).toHaveBeenLastCalledWith('ar');
  expect(usePreferenceStore.getState().locale).toBe('ar');

  finishArabic();
  await switchingBackToArabic;

  expect(usePreferenceStore.getState()).toMatchObject({
    locale: 'ar',
    direction: 'rtl'
  });
  expect(mockSavePreferences).not.toHaveBeenCalled();
});

it('restores the committed demo locale when the latest queued switch fails', async () => {
  process.env.EXPO_PUBLIC_DEMO_MODE = '1';
  let finishEnglish!: () => void;
  synchronizeDemoLocale
    .mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finishEnglish = () => resolve(true);
      })
    )
    .mockRejectedValueOnce(new Error('Arabic synchronization failed'))
    .mockResolvedValueOnce(true);

  const switchingToEnglish = usePreferenceStore.getState().setLocale('en');
  const switchingBackToArabic = usePreferenceStore.getState().setLocale('ar');
  finishEnglish();

  await expect(switchingToEnglish).resolves.toBe(false);
  await expect(switchingBackToArabic).resolves.toBe(false);

  expect(synchronizeDemoLocale.mock.calls.map(([locale]) => locale)).toEqual([
    'en',
    'ar',
    'ar'
  ]);
  expect(usePreferenceStore.getState()).toMatchObject({
    locale: 'ar',
    direction: 'rtl'
  });
  expect(mockSavePreferences).not.toHaveBeenCalled();
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

it('waits for an active hydration normalization write', async () => {
  mockLoadPreferences.mockResolvedValue(buildPreferences({ theme: 'dark' }));
  let finishSave!: () => void;
  mockSavePreferences.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishSave = resolve;
    })
  );

  const firstHydration = usePreferenceStore.getState().hydrate();
  await Promise.resolve();
  await Promise.resolve();
  expect(mockSavePreferences).toHaveBeenCalled();

  let secondHydrationFinished = false;
  const secondHydration = usePreferenceStore
    .getState()
    .hydrate()
    .then(() => {
      secondHydrationFinished = true;
    });
  await Promise.resolve();
  expect(secondHydrationFinished).toBe(false);

  finishSave();
  await Promise.all([firstHydration, secondHydration]);
  expect(secondHydrationFinished).toBe(true);
});

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

it('drops in-memory user preferences when runtime user data resets', () => {
  usePreferenceStore.setState({
    ...buildPreferences({
      locale: 'en',
      defaultAccountId: 'account-1',
      trackingPersonalization: false
    }),
    hydrated: true
  });

  resetRuntimeUserData();

  expect(usePreferenceStore.getState()).toMatchObject({
    locale: 'ar',
    direction: 'rtl',
    defaultAccountId: null,
    trackingPersonalization: true,
    hydrated: true
  });
});
