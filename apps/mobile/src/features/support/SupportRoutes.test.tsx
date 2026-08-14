import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SupportLayout = require('@app/support/_layout').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SupportHomeRoute = require('@app/support').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NewSupportRoute = require('@app/support/new').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TicketsRoute = require('@app/support/tickets').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TicketDetailRoute = require('@app/support/tickets/[id]').default as () => React.ReactElement;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SupportHomeScreen } = require('./SupportHomeScreen') as { SupportHomeScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SupportFormScreen } = require('./SupportFormScreen') as { SupportFormScreen: React.ComponentType<{ mode?: string; context?: unknown }> };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TicketListScreen } = require('./TicketListScreen') as { TicketListScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TicketDetailScreen } = require('./TicketDetailScreen') as { TicketDetailScreen: React.ComponentType<{ ticketId: string }> };

let mockParams = { id: 'ticket-1', mode: 'transaction_report', context: '{"itemId":"transaction-1","itemKind":"transaction","category":"technical","status":"posted","appVersion":"1.0.0","diagnosticCategory":"transaction"}' };

jest.mock('expo-router', () => ({
  Stack: Object.assign(() => null, { Screen: () => null }),
  useLocalSearchParams: () => mockParams
}));

test('support routes are thin render-only modules with typed report-mode parameters', () => {
  expect(SupportLayout()).toBeTruthy();
  expect(SupportHomeRoute()).toEqual(<SupportHomeScreen />);
  expect(NewSupportRoute()).toEqual(<SupportFormScreen mode="transaction_report" context={{ itemId: 'transaction-1', itemKind: 'transaction', category: 'technical', status: 'posted', appVersion: '1.0.0', diagnosticCategory: 'transaction' }} />);
  expect(TicketsRoute()).toEqual(<TicketListScreen />);
  expect(TicketDetailRoute()).toEqual(<TicketDetailScreen ticketId="ticket-1" />);

  for (const path of [
    'app/support/_layout.tsx',
    'app/support/index.tsx',
    'app/support/new.tsx',
    'app/support/tickets/index.tsx',
    'app/support/tickets/[id].tsx'
  ]) {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).not.toMatch(/sqlite|storage\/|https?:\/\/|payment|provider/i);
  }
});

test('support new route drops unsafe or incompatible deep-link context', () => {
  mockParams = { id: 'ticket-1', mode: 'transaction_report', context: '{"itemId":"transaction-1","amountMinor":2500,"secret":"token"}' };
  expect(NewSupportRoute()).toEqual(<SupportFormScreen mode="transaction_report" context={null} />);

  mockParams = { id: 'ticket-1', mode: 'assistant_report', context: '{"itemId":"transaction-1","itemKind":"transaction","category":"technical","status":"posted","appVersion":"1.0.0","diagnosticCategory":"transaction"}' };
  expect(NewSupportRoute()).toEqual(<SupportFormScreen mode="assistant_report" context={null} />);
});
