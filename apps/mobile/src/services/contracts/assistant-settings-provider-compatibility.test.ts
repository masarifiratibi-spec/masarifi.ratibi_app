import { assertCompatibleProvider } from './capability-contract';
import {
  assistantServiceCapability,
  notificationServiceCapability,
  settingsServiceCapability,
  subscriptionServiceCapability,
  supportServiceCapability
} from './assistant-notifications-service';
import { createMockAssistantNotificationsService } from '@/services/mocks/assistant-notifications-service';
import { createMockAssistantService } from '@/services/mocks/assistant-service';
import {
  createMockSettingsService,
  createMockSubscriptionService
} from '@/services/mocks/subscription-settings-service';
import { createMockSupportService } from '@/services/mocks/support-service';

describe('assistant/notifications/subscriptions/support/settings provider compatibility', () => {
  it('declares compatible providers and safe provider-error outcomes', async () => {
    const notifications = createMockAssistantNotificationsService();
    const assistant = createMockAssistantService({ offline: true });
    const subscriptions = createMockSubscriptionService();
    const settings = createMockSettingsService();
    const support = createMockSupportService({ failNextOperation: 'offline' });

    expect(assertCompatibleProvider(notificationServiceCapability, notifications.metadata)).toBe(notifications.metadata);
    expect(assertCompatibleProvider(assistantServiceCapability, assistant.metadata)).toBe(assistant.metadata);
    expect(assertCompatibleProvider(subscriptionServiceCapability, subscriptions.metadata)).toBe(subscriptions.metadata);
    expect(assertCompatibleProvider(settingsServiceCapability, settings.metadata)).toBe(settings.metadata);
    expect(assertCompatibleProvider(supportServiceCapability, support.metadata)).toBe(support.metadata);

    await expect(assistant.createConversation({ question: 'safe?' }, 'op-assistant-1')).rejects.toMatchObject({ code: 'consent_required' });
    await expect(subscriptions.getCatalog()).resolves.toMatchObject({ version: expect.any(String) });
    await expect(settings.getProfile()).resolves.toMatchObject({ version: expect.any(Number) });
    await expect(support.searchArticles({ query: 'card' })).resolves.toEqual(expect.any(Array));
  });

  it('does not report early success for failed support submission', async () => {
    const support = createMockSupportService({ failNextOperation: 'offline' });
    expect(assertCompatibleProvider(supportServiceCapability, support.metadata)).toBe(support.metadata);
    const draft = await support.saveDraft({
      id: 'draft-1',
      mode: 'ticket',
      category: 'technical',
      subject: 'Cannot sync',
      description: 'Safe fixture text',
      ticketId: null,
      context: null
    });
    await expect(support.submitDraft(draft.id, 'op-support-1')).resolves.toMatchObject({
      value: { status: 'failed', safeFailure: 'offline' }
    });
  });

  it('rejects incompatible assistant providers before execution', () => {
    const execute = jest.fn();
    expect(() =>
      assertCompatibleProvider(assistantServiceCapability, {
        id: 'assistant-v2',
        capability: assistantServiceCapability.capability,
        majorVersion: 2,
        kind: 'mock',
        availability: 'available'
      })
    ).toThrow('incompatible provider');
    expect(execute).not.toHaveBeenCalled();
  });
});
