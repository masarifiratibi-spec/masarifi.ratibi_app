import React from 'react';
import { ScrollView } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import type { NotificationActionKind } from '@/domain/notifications';
import { assistantNotificationsService } from '@/services/mocks/assistant-notifications-service';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';

export function NativeNotificationValidationScreen() {
  const [status, setStatus] = React.useState('notifications.validation.ready');

  async function present(action: NotificationActionKind, expired = false) {
    setStatus('notifications.validation.presenting');
    const createdAt = Date.now();
    const id = `native-validation-${action}-${createdAt}`;
    try {
      const event = await assistantNotificationsService.createFromSource({
        eventKey: id,
        category: 'transaction',
        eventType: 'native_validation',
        titleKey: 'notifications.validation.title',
        bodyKey: 'notifications.validation.body',
        messageValues: {},
        sensitivity: 'public',
        target: { kind: 'transaction', transactionId: 'transaction-1' },
        availableActions: [{ kind: action, expiresAt: action === 'undo' ? (expired ? createdAt - 1 : createdAt + 300_000) : null, sourceVersion: action === 'undo' ? 1 : null }],
        occurredAt: createdAt
      });
      await phoneNotificationService.registerCategories();
      const result = await phoneNotificationService.presentLocal({
        notificationId: event.id,
        title: 'Masarifi validation',
        body: 'Open the requested validation action.',
        categoryId: 'financial-change'
      });
      setStatus(result.status === 'presented' ? 'notifications.validation.presented' : 'notifications.validation.failed');
    } catch {
      setStatus('notifications.validation.failed');
    }
  }

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">notifications.validation.title</StyledText>
      <StyledText>{status}</StyledText>
      <ActionButton label="notifications.validation.view" onPress={() => void present('view')} />
      <ActionButton label="notifications.validation.edit" onPress={() => void present('edit')} />
      <ActionButton label="notifications.validation.undo" onPress={() => void present('undo')} />
      <ActionButton label="notifications.validation.expired" onPress={() => void present('undo', true)} />
    </ScrollView>
  );
}
