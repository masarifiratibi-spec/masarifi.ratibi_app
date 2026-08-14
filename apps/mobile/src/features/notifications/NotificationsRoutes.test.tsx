import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import NotificationsLayout from '@app/notifications/_layout';
import NotificationsRoute from '@app/notifications';
import NotificationPreferencesRoute from '@app/notifications/preferences';
import { NotificationCenterScreen } from './NotificationCenterScreen';
import { NotificationPreferencesScreen } from './NotificationPreferencesScreen';

it('owns /notifications with render-only route modules and no storage access', () => {
  expect(typeof NotificationsLayout).toBe('function');
  expect(typeof NotificationsRoute).toBe('function');
  expect(typeof NotificationPreferencesRoute).toBe('function');
  expect(NotificationsRoute()).toEqual(<NotificationCenterScreen />);
  expect(NotificationPreferencesRoute()).toEqual(<NotificationPreferencesScreen />);

  ['app/notifications/_layout.tsx', 'app/notifications/index.tsx', 'app/notifications/preferences.tsx'].forEach((path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).not.toMatch(/sqlite|storage\//i);
  });
});
