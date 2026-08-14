import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SubscriptionRoute = require('@app/subscriptions').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CheckoutRoute = require('@app/subscriptions/checkout').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ManageRoute = require('@app/subscriptions/manage').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SubscriptionScreen } = require('./SubscriptionScreen') as { SubscriptionScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SubscriptionCheckoutScreen } = require('./SubscriptionCheckoutScreen') as { SubscriptionCheckoutScreen: React.ComponentType<{ offerId?: string }> };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SubscriptionManageScreen } = require('./SubscriptionManageScreen') as { SubscriptionManageScreen: React.ComponentType<{ operationId?: string }> };

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ offerId: 'basic-monthly', operationId: 'op-1', url: 'https://evil.example' }) }));

test('owns subscription routes with thin render-only modules', () => {
  expect(SubscriptionRoute()).toEqual(<SubscriptionScreen />);
  expect(CheckoutRoute()).toEqual(<SubscriptionCheckoutScreen offerId="basic-monthly" />);
  expect(ManageRoute()).toEqual(<SubscriptionManageScreen operationId="op-1" />);

  [
    'app/subscriptions/index.tsx',
    'app/subscriptions/checkout.tsx',
    'app/subscriptions/manage.tsx',
    'app/subscriptions/_layout.tsx'
  ].forEach((path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).not.toMatch(/sqlite|storage\/|payment|provider|card|visa|https?:\/\//i);
  });
});
