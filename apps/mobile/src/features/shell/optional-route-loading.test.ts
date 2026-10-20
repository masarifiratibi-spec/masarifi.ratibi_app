import type { ReactElement } from 'react';

const optionalRoutes = [
  ['@app/support/tickets/[id]', '@/features/support/TicketDetailScreen'],
  ['@app/support/tickets/index', '@/features/support/TicketListScreen'],
  ['@app/support/new', '@/features/support/SupportFormScreen'],
  ['@app/support/index', '@/features/support/SupportHomeScreen'],
  ['@app/subscriptions/manage', '@/features/subscriptions/SubscriptionManageScreen'],
  ['@app/subscriptions/index', '@/features/subscriptions/SubscriptionScreen'],
  ['@app/subscriptions/checkout', '@/features/subscriptions/SubscriptionCheckoutScreen'],
  ['@app/settings/month-start', '@/features/settings/CycleStartDaySelectionScreen'],
  ['@app/settings/currency', '@/features/settings/CurrencySelectionScreen'],
  ['@app/settings/application', '@/features/settings/ApplicationSettingsScreen'],
  ['@app/security/unlock', '@/features/security/UnlockScreen'],
  ['@app/security/sessions', '@/features/settings/SessionListScreen'],
  ['@app/security/pin/create', '@/features/security/PinSetupScreen'],
  ['@app/security/pin/change', '@/features/security/PinSetupScreen'],
  ['@app/security/events', '@/features/settings/SecurityEventScreen'],
  ['@app/foundation/notifications', '@/features/notifications/NativeNotificationValidationScreen'],
  ['@app/foundation/accessibility', '@/features/foundation/AccessibilityStateGallery'],
  ['@app/profile/privacy', '@/features/settings/PrivacySettingsScreen'],
  ['@app/profile/phone', '@/features/settings/ProfilePhoneScreen'],
  ['@app/profile/index', '@/features/settings/ProfileScreen'],
  ['@app/profile/application', '@/features/settings/ApplicationSettingsScreen']
] as const;

it('discovers optional destinations without initializing their screens', () => {
  for (const [route] of optionalRoutes) {
    expect(jest.requireActual(route).default).toEqual(expect.any(Function));
  }

  const initializedBeforeNavigation = optionalRoutes
    .filter(([, screen]) => require.cache[require.resolve(screen)])
    .map(([route]) => route);
  expect(initializedBeforeNavigation).toEqual([]);
});

it('initializes the selected subscription screen when its route renders', () => {
  const screenPath = '@/features/subscriptions/SubscriptionScreen';
  expect(require.cache[require.resolve(screenPath)]).toBeUndefined();
  const Route = jest.requireActual<{ default: () => ReactElement }>(
    '@app/subscriptions/index'
  ).default;

  const element = Route();

  expect(require.cache[require.resolve(screenPath)]).toBeDefined();
  expect(element.type).toBe(
    jest.requireActual<typeof import('../subscriptions/SubscriptionScreen')>(
      screenPath
    ).SubscriptionScreen
  );
});
