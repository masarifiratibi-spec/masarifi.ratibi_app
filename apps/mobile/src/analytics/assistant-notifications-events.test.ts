import {
  assistantNotificationsEventNames,
  createAssistantNotificationsEvent
} from './assistant-notifications-events';
import type { AssistantNotificationsEventPayload } from './assistant-notifications-events';

describe('assistant notification analytics', () => {
  it('records only the fixed event names with scalar category and outcome values', () => {
    expect(assistantNotificationsEventNames).toEqual([
      'assistant_notifications.notification',
      'assistant_notifications.assistant',
      'assistant_notifications.subscription',
      'assistant_notifications.settings',
      'assistant_notifications.support'
    ]);
    expect(
      createAssistantNotificationsEvent('assistant_notifications.notification', {
        category: 'notification',
        outcome: 'opened'
      })
    ).toMatchObject({
      name: 'assistant_notifications.notification',
      payload: { category: 'notification', outcome: 'opened' }
    });
  });

  it.each([
    { amountMinor: 12500 },
    { currency: 'SAR' },
    { title: 'Payment received' },
    { body: 'Your balance changed' },
    { question: 'How much did I spend?' },
    { answer: 'You spent 125 SAR' },
    { sourceId: 'transaction-1' },
    { email: 'person@example.com' },
    { phone: '+966500000000' },
    { ticketDescription: 'Please help with my account' },
    { pin: '1234' },
    { payload: { outcome: 'opened' } },
    { outcome: 'my own words' }
  ])('rejects sensitive or user-authored payloads: %o', (payload) => {
    expect(() =>
      createAssistantNotificationsEvent(
        'assistant_notifications.notification',
        payload as never
      )
    ).toThrow('Sensitive analytics payload');
  });

  it('copies the payload and freezes the returned event after validation', () => {
    const payload: AssistantNotificationsEventPayload = {
      category: 'notification',
      outcome: 'opened'
    };
    const event = createAssistantNotificationsEvent(
      'assistant_notifications.notification',
      payload
    );

    payload.outcome = 'failed';
    Object.assign(payload as Record<string, unknown>, { question: 'user-authored text' });

    expect(event.payload).toEqual({ category: 'notification', outcome: 'opened' });
    expect(() => Object.assign(event.payload, { question: 'user-authored text' })).toThrow();
    expect(() => Object.assign(event, { name: 'assistant_notifications.support' })).toThrow();
    expect(event).toMatchObject({
      name: 'assistant_notifications.notification',
      payload: { category: 'notification', outcome: 'opened' }
    });
  });
});
