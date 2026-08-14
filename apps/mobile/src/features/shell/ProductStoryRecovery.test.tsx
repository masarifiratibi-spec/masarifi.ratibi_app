import type { NotificationService, PhoneNotificationResponse, PhoneNotificationService } from '@/services/contracts/assistant-notifications-service';
import { createNotificationResponseController } from '@/features/notifications/notification-response-controller';
import { createMockTrackingPermissionService } from '@/services/mocks/tracking-permission-service';

type ResponseService = Pick<NotificationService, 'executeAction' | 'resolveTarget' | 'revalidateAction'>;

it('covers permission denial and settings recovery without requesting before education', async () => {
  const permission = createMockTrackingPermissionService('denied');

  expect(await permission.getState()).toMatchObject({
    status: 'denied',
    recoveryAction: 'retry'
  });
  await expect(permission.requestAfterEducation(false)).resolves.toMatchObject({ status: 'denied' });
  await expect(permission.requestAfterEducation(true)).resolves.toMatchObject({ status: 'granted' });

  const permanent = createMockTrackingPermissionService('permanently_denied');
  expect(await permanent.getState()).toMatchObject({ recoveryAction: 'open_settings' });
  await permanent.openSettings();
  expect(await permanent.getState()).toMatchObject({ status: 'revoked', recoveryAction: 'open_settings' });
});

it('handles foreground, background, cold, invalid targets, unlock, offline retry, and duplicate notification responses', async () => {
  const navigate = jest.fn();
  const unlock = jest.fn(async () => true);
  const executeAction = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({
      value: { id: 'undo', target: { kind: 'transaction', transactionId: 'transaction-1' } },
      affectedScopes: []
    });
  const service = targetService({ executeAction });
  const phone = phoneService({ notificationId: 'cold', action: 'view' });
  const controller = createNotificationResponseController({
    notificationService: service,
    phoneService: phone.phone,
    navigate,
    unlock
  });

  await controller.start();
  await phone.emit({ notificationId: 'foreground', action: 'edit' });
  await phone.emit({ notificationId: 'deleted', action: 'view' });
  await phone.emit({ notificationId: 'expired', action: 'undo' });
  await phone.emit({ notificationId: 'changed', action: 'view' });
  await Promise.all([
    controller.handle({ notificationId: 'protected', action: 'edit' }),
    controller.handle({ notificationId: 'protected', action: 'edit' })
  ]);
  await controller.handle({ notificationId: 'undo', action: 'undo' });
  await controller.handle({ notificationId: 'undo', action: 'undo' });
  controller.stop();

  expect(navigate).toHaveBeenCalledWith('/transactions/transaction-1');
  expect(navigate).toHaveBeenCalledWith('/transactions/transaction-1/edit');
  expect(navigate).toHaveBeenCalledWith('/notifications');
  expect(navigate).toHaveBeenCalledWith('/obligations/obligation-1/edit');
  expect(unlock).toHaveBeenCalled();
  expect(executeAction).toHaveBeenCalledTimes(2);
  expect(executeAction).toHaveBeenLastCalledWith('undo', 'undo', 'notification-response-undo-undo');
  expect(phone.unsubscribe).toHaveBeenCalledTimes(1);
});

function targetService(overrides: Partial<ResponseService> = {}): ResponseService {
  return {
    resolveTarget: jest.fn(async (id: string) => {
      if (id === 'deleted') return { status: 'unavailable' as const, target: null };
      if (id === 'protected') return { status: 'unlock_required' as const, target: { kind: 'obligation' as const, obligationId: 'obligation-1' } };
      return { status: 'exact' as const, target: { kind: 'transaction' as const, transactionId: 'transaction-1' } };
    }),
    revalidateAction: jest.fn(async (id: string, action) => {
      if (id === 'expired') return { status: 'expired' as const, target: { kind: 'transaction' as const, transactionId: 'transaction-1' }, action };
      if (id === 'changed') return { status: 'unavailable' as const, target: { kind: 'transaction' as const, transactionId: 'transaction-1' }, action };
      if (id === 'protected') return { status: 'available' as const, target: { kind: 'obligation' as const, obligationId: 'obligation-1' }, action };
      return { status: 'available' as const, target: { kind: 'transaction' as const, transactionId: 'transaction-1' }, action };
    }),
    executeAction: jest.fn(async () => ({
      value: { id: 'undo', target: { kind: 'transaction' as const, transactionId: 'transaction-1' } },
      affectedScopes: []
    })),
    ...overrides
  };
}

function phoneService(lastResponse: PhoneNotificationResponse | null = null) {
  let listener: ((response: PhoneNotificationResponse) => void) | null = null;
  const unsubscribe = jest.fn();
  const phone: Pick<PhoneNotificationService, 'getLastResponse' | 'subscribeToResponses'> = {
    getLastResponse: jest.fn(async () => lastResponse),
    subscribeToResponses: jest.fn((next) => {
      listener = next;
      return unsubscribe;
    })
  };
  return {
    phone,
    emit: async (response: PhoneNotificationResponse) => {
      listener?.(response);
      await Promise.resolve();
      await Promise.resolve();
    },
    unsubscribe
  };
}
