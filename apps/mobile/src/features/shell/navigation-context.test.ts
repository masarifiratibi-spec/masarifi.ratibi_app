import {
  assistantActionDestination,
  assistantConversationDestination,
  createReturnContext,
  sanitizeReturnRoute,
  shellDestinations,
  supportTicketDestination
} from './navigation-context';

describe('navigation context', () => {
  it('accepts approved Accounts and assistant origins and rejects sensitive query data', () => {
    for (const origin of ['/(tabs)/home', '/(tabs)/more', '/(tabs)/transactions', '/(tabs)/reports']) {
      expect(createReturnContext('/accounts', origin)).toEqual({
        destination: '/accounts',
        returnTo: origin
      });
      expect(createReturnContext('/assistant', origin)).toEqual({
        destination: '/assistant',
        returnTo: origin
      });
    }

    expect(sanitizeReturnRoute('/(public)/otp?code=123456')).toBeNull();
    expect(sanitizeReturnRoute('/accounts?phone=123')).toBeNull();
    expect(shellDestinations).toContain('/security/settings');
  });

  it('normalizes every approved SPEC-009 static and typed dynamic destination', () => {
    for (const route of [
      '/notifications',
      '/notifications/preferences',
      '/assistant',
      '/subscriptions',
      '/subscriptions/checkout',
      '/profile',
      '/profile/application',
      '/profile/privacy',
      '/security/settings',
      '/security/sessions',
      '/security/events',
      '/support',
      '/support/new',
      '/support/tickets'
    ]) {
      expect(sanitizeReturnRoute(route)).toBe(route);
      expect(shellDestinations).toContain(route);
    }

    expect(assistantConversationDestination('conversation_1')).toBe('/assistant/conversation_1');
    expect(assistantActionDestination('conversation_1', 'preview-1')).toBe(
      '/assistant/conversation_1/actions/preview-1'
    );
    expect(supportTicketDestination('ticket-1')).toBe('/support/tickets/ticket-1');
  });

  it('rejects raw URLs, queries, unsafe parameters, and sensitive destinations', () => {
    for (const route of [
      'https://example.com/assistant',
      '/assistant/conversation-1?token=secret',
      '/assistant/conversation/1',
      '/assistant/otp-123',
      '/support/tickets/ticket id'
    ]) {
      expect(sanitizeReturnRoute(route)).toBeNull();
    }
    expect(assistantConversationDestination('../conversation')).toBeNull();
    expect(assistantActionDestination('conversation-1', 'preview?token=secret')).toBeNull();
    expect(supportTicketDestination('ticket/1')).toBeNull();
  });

  it('preserves safe nested finance destinations without query data', () => {
    for (const route of [
      '/accounts/account-1/edit',
      '/transactions/transaction-1',
      '/categories/category-1',
      '/budgets/budget-1',
      '/salary/salary-1',
      '/obligations/obligation-1',
      '/savings/saving-1'
    ]) {
      expect(sanitizeReturnRoute(route)).toBe(route);
    }
    expect(sanitizeReturnRoute('/security/pin/change')).toBeNull();
  });
});
