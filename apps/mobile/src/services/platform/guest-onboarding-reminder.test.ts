import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';
import {
  synchronizeGuestOnboardingReminder,
  consumeGuestOnboardingReminder
} from './guest-onboarding-reminder';

jest.mock('@/config/mobile-automation', () => ({
  isMobileAutomationEnabled: jest.fn(() => true)
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '78c71e06-457f-4f20-95f6-9db73c114a73'
}));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn()
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));
const n = jest.mocked(Notifications);
const s = jest.mocked(SecureStore);
const gate = jest.requireMock('@/config/mobile-automation')
  .isMobileAutomationEnabled as jest.Mock;
let record: string | null;
let accountSeen: string | null;
let pending: { identifier: string }[];
const guest = { enabled: true, hasAccount: false, locale: 'en' as const };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-10-21T09:00:00Z'));
  gate.mockReturnValue(true);
  record = null;
  accountSeen = null;
  pending = [];
  s.getItemAsync.mockImplementation(async (key) => key.includes('account-created') ? accountSeen : record);
  s.setItemAsync.mockImplementation(async (key, value) => {
    if (key.includes('account-created')) accountSeen = value;
    else record = value;
  });
  s.deleteItemAsync.mockImplementation(async () => {
    record = null;
  });
  n.getAllScheduledNotificationsAsync.mockImplementation(
    async () => pending as never
  );
  n.scheduleNotificationAsync.mockImplementation(async (input) => {
    pending = [{ identifier: input.identifier! }];
    return input.identifier!;
  });
  n.cancelScheduledNotificationAsync.mockImplementation(async () => {
    pending = [];
  });
});
afterEach(() => jest.useRealTimers());

it('schedules a single private reminder 24 hours after explicit opt-in', async () => {
  await synchronizeGuestOnboardingReminder(guest);
  expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const scheduled = n.scheduleNotificationAsync.mock.calls[0][0];
  expect(scheduled.content).toMatchObject({
    title: 'Finish setting up your account',
    body: 'You’re one step away from tracking your spending.',
    data: { kind: 'onboarding_resume', cycleId: expect.any(String) }
  });
  expect(scheduled.content.data).not.toHaveProperty('notificationId');
  expect(scheduled.trigger).toMatchObject({
    type: 'date',
    date: new Date('2026-10-22T09:00:00Z')
  });
});

it('keeps the same pending reminder and deadline on process reopen', async () => {
  await synchronizeGuestOnboardingReminder(guest);
  jest.advanceTimersByTime(60_000);
  await synchronizeGuestOnboardingReminder(guest);
  expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
});

it('preserves the guest cycle when cold restore correctly finds no signed-in account', async () => {
  await synchronizeGuestOnboardingReminder(guest);
  await resetRuntimeIdentityData({ kind: 'restore-unavailable' });
  await synchronizeGuestOnboardingReminder(guest);
  expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(pending).toHaveLength(1);
});

it('replaces a pending reminder in Arabic without changing the due time', async () => {
  await synchronizeGuestOnboardingReminder(guest);
  await synchronizeGuestOnboardingReminder({ ...guest, locale: 'ar' });
  expect(n.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(n.scheduleNotificationAsync.mock.calls[1][0]).toMatchObject({
    identifier: n.scheduleNotificationAsync.mock.calls[0][0].identifier,
    content: { title: 'أكمل إعداد حسابك' },
    trigger: { date: new Date('2026-10-22T09:00:00Z') }
  });
});

it.each([{ enabled: false }, { hasAccount: true }])(
  'cancels on opt-out or account creation: %j',
  async (change) => {
    await synchronizeGuestOnboardingReminder(guest);
    await synchronizeGuestOnboardingReminder({ ...guest, ...change });
    expect(pending).toEqual([]);
    expect(record).toBeNull();
  }
);

it('does not revive an already due reminder on reopen or language changes', async () => {
  await synchronizeGuestOnboardingReminder(guest);
  pending = [];
  jest.advanceTimersByTime(25 * 60 * 60 * 1000);
  await synchronizeGuestOnboardingReminder({ ...guest, locale: 'ar' });
  expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
});

it('recovers a persisted cycle whose platform schedule was interrupted', async () => {
  await synchronizeGuestOnboardingReminder(guest);
  pending = [];
  await synchronizeGuestOnboardingReminder(guest);
  expect(n.scheduleNotificationAsync.mock.calls[1][0].identifier).toBe(
    n.scheduleNotificationAsync.mock.calls[0][0].identifier
  );
});

it('ignores stale or foreign taps and consumes the current cycle once', async () => {
  await synchronizeGuestOnboardingReminder(guest);
  const cycleId = n.scheduleNotificationAsync.mock.calls[0][0].content.data!
    .cycleId as string;
  await expect(consumeGuestOnboardingReminder('old-cycle')).resolves.toBe(
    false
  );
  await expect(consumeGuestOnboardingReminder(cycleId)).resolves.toBe(true);
  await expect(consumeGuestOnboardingReminder(cycleId)).resolves.toBe(false);
  await synchronizeGuestOnboardingReminder(guest);
  expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
});

it('does nothing in the ordinary app', async () => {
  gate.mockReturnValue(false);
  await synchronizeGuestOnboardingReminder(guest);
  expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(s.getItemAsync).not.toHaveBeenCalled();
});

it('does not start another guest reminder after an account was created and then signed out', async () => {
  await synchronizeGuestOnboardingReminder(guest);
  await synchronizeGuestOnboardingReminder({ ...guest, hasAccount: true });
  await synchronizeGuestOnboardingReminder(guest);
  expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(pending).toEqual([]);
});

it('cancels a schedule that finishes after an account handoff', async () => {
  let release!: () => void;
  let started!: () => void;
  const scheduling = new Promise<void>((done) => {
    started = done;
  });
  n.scheduleNotificationAsync.mockImplementationOnce(async (input) => {
    started();
    await new Promise<void>((done) => {
      release = done;
    });
    pending = [{ identifier: input.identifier! }];
    return input.identifier!;
  });
  const optIn = synchronizeGuestOnboardingReminder(guest);
  await scheduling;
  const handoff = synchronizeGuestOnboardingReminder({
    ...guest,
    hasAccount: true
  });
  release();
  await Promise.all([optIn, handoff]);
  expect(pending).toEqual([]);
  expect(record).toBeNull();
});
