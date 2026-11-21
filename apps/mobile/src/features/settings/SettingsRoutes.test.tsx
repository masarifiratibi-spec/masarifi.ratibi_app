import React from 'react';
import { Redirect } from 'expo-router';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ProfileRoute = require('@app/profile').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ApplicationRoute = require('@app/profile/application').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PrivacyRoute = require('@app/profile/privacy').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SecuritySettingsRoute = require('@app/security/settings').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SessionsRoute = require('@app/security/sessions').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EventsRoute = require('@app/security/events').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ProfileScreen } = require('./ProfileScreen') as { ProfileScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ApplicationSettingsScreen } = require('./ApplicationSettingsScreen') as { ApplicationSettingsScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrivacySettingsScreen } = require('./PrivacySettingsScreen') as { PrivacySettingsScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SessionListScreen } = require('./SessionListScreen') as { SessionListScreen: React.ComponentType };

test('owns settings/security routes with thin render-only modules', () => {
  expect(ProfileRoute()).toEqual(<ProfileScreen />);
  expect(ApplicationRoute()).toEqual(<ApplicationSettingsScreen />);
  expect(PrivacyRoute()).toEqual(<PrivacySettingsScreen />);
  expect(SessionsRoute()).toEqual(<SessionListScreen />);
  expect(EventsRoute()).toEqual(<Redirect href="/security/settings" />);
  expect(SecuritySettingsRoute).toEqual(expect.any(Function));

  [
    'app/profile/index.tsx',
    'app/profile/application.tsx',
    'app/profile/privacy.tsx',
    'app/security/settings.tsx',
    'app/security/sessions.tsx',
    'app/security/events.tsx'
  ].forEach((path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).not.toMatch(/sqlite|storage\/|settings\.privacy\.completed|https?:\/\//i);
  });
});
