import type {
  NotificationService,
  PhoneNotificationResponse,
  PhoneNotificationService
} from '@/services/contracts/assistant-notifications-service';

import { createNotificationResponseController } from './notification-response-controller';

type ResponseService = Pick<
  NotificationService,
  'executeAction' | 'resolveTarget' | 'revalidateAction'
>;

function targetService(overrides: Partial<ResponseService> = {}): ResponseService {
  return {
    resolveTarget: jest.fn(async () => ({
      status: 'exact' as const,
      target: { kind: 'transaction' as const, transactionId: 'transaction-1' }
    })),
    revalidateAction: jest.fn(async (_id, action) => ({
      status: 'available' as const,
      target: { kind: 'transaction' as const, transactionId: 'transaction-1' },
      action
    })),
    executeAction: jest.fn(async () => ({
      value: {
        id: 'notification-1',
        target: { kind: 'transaction' as const, transactionId: 'transaction-1' }
      },
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
      await Promise.resolve();
    },
    unsubscribe
  };
}

describe('notification response controller', () => {
  it.each([
    ['view', '/budgets/transactions/budget-1'],
    ['edit', '/budgets/edit/budget-1']
  ] as const)('opens an existing budget destination for a %s notification without posting', async (action, destination) => {
    const target = { kind: 'budget' as const, budgetId: 'budget-1' };
    const service = targetService({
      resolveTarget: jest.fn(async () => ({ status: 'exact' as const, target })),
      revalidateAction: jest.fn(async (_id, kind) => ({
        status: 'available' as const,
        target,
        action: kind
      }))
    });
    const navigate = jest.fn();
    const controller = createNotificationResponseController({
      notificationService: service,
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true
    });

    await controller.handle({ notificationId: 'budget-notification', action });

    expect(navigate).toHaveBeenCalledWith(destination);
    expect(service.executeAction).not.toHaveBeenCalled();
  });

  it('defers a cold remote tap until delayed shell and Clerk readiness, then resolves it once', async () => {
    let becomeReady!: (ready: boolean) => void;
    const ready = new Promise<boolean>((resolve) => { becomeReady = resolve; });
    const service = targetService();
    const navigate = jest.fn();
    const controller = createNotificationResponseController({ notificationService: service, phoneService: phoneService({ notificationId: 'cold', action: 'view' }).phone, navigate, unlock: async () => true, waitForRemoteReady: () => ready });
    const starting = controller.start();
    await Promise.resolve();
    expect(service.resolveTarget).not.toHaveBeenCalled();
    becomeReady(true);
    await starting;
    expect(service.resolveTarget).toHaveBeenCalledWith('cold');
    expect(navigate).toHaveBeenCalledWith('/transactions/transaction-1');
    controller.stop();
  });
  it.each(['cold', 'live'])('handles %s local onboarding taps separately from authenticated financial resolution', async (mode) => {
    const service = targetService();
    const resumeOnboarding = jest.fn(async () => undefined);
    const navigate = jest.fn();
    const local = { kind: 'onboarding_resume' as const, cycleId: '78c71e06-457f-4f20-95f6-9db73c114a73', action: 'view' as const };
    const phone = phoneService(mode === 'cold' ? local : null);
    const controller = createNotificationResponseController({ notificationService: service, phoneService: phone.phone, navigate, unlock: async () => true, resumeOnboarding });
    await controller.start();
    if (mode === 'live') await phone.emit(local);
    expect(resumeOnboarding).toHaveBeenCalledWith('78c71e06-457f-4f20-95f6-9db73c114a73');
    expect(service.resolveTarget).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    controller.stop();
  });
  it('opens the credit card from a due reminder', async () => {
    const target = { kind: 'account' as const, accountId: 'card-1' };
    const navigate = jest.fn();
    const controller = createNotificationResponseController({
      notificationService: targetService({
        resolveTarget: jest.fn(async () => ({ status: 'exact' as const, target })),
        revalidateAction: jest.fn(async (_id, action) => ({ status: 'available' as const, target, action }))
      }),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true
    });
    await controller.handle({ notificationId: 'reminder', action: 'view' });
    expect(navigate).toHaveBeenCalledWith('/accounts/card-1');
  });
  it('routes an exact resolved view target through the typed mapping', async () => {
    const navigate = jest.fn();
    const controller = createNotificationResponseController({
      notificationService: targetService(),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true
    });

    await controller.handle({ notificationId: 'notification-1', action: 'view' });

    expect(navigate).toHaveBeenCalledWith('/transactions/transaction-1');
  });

  it.each([
    [{ kind: 'home' }, '/(tabs)/home'],
    [{ kind: 'tracking' }, '/tracking'],
  ])('opens the existing reminder destination', async (target, route) => {
    const navigate = jest.fn();
    const controller = createNotificationResponseController({
      notificationService: targetService({
        resolveTarget: jest.fn(async () => ({ status: 'exact', target })) as never,
        revalidateAction: jest.fn(async (_id, action) => ({
          status: 'available', target, action,
        })) as never,
      }),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true,
    });

    await controller.handle({ notificationId: 'reminder-1', action: 'view' });

    expect(navigate).toHaveBeenCalledWith(route);
  });

  it('uses a trusted fallback target and returns unavailable targets to notifications', async () => {
    const navigate = jest.fn();
    const controller = createNotificationResponseController({
      notificationService: targetService({
        resolveTarget: jest.fn(async () => ({
          status: 'fallback' as const,
          target: { kind: 'settings' as const, key: 'notifications' as const }
        })),
        revalidateAction: jest.fn(async (_id, action) => ({
          status: 'available' as const,
          target: { kind: 'settings' as const, key: 'notifications' as const },
          action
        }))
      }),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true
    });

    await controller.handle({ notificationId: 'fallback', action: 'view' });
    expect(navigate).toHaveBeenLastCalledWith('/notifications/preferences');

    const unavailable = createNotificationResponseController({
      notificationService: targetService({
        resolveTarget: jest.fn(async () => ({ status: 'unavailable' as const, target: null }))
      }),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true
    });
    await unavailable.handle({ notificationId: 'deleted', action: 'view' });

    expect(navigate).toHaveBeenLastCalledWith('/notifications');
  });

  it('replays cold and live responses through the same handler and unsubscribes', async () => {
    const navigate = jest.fn();
    const phone = phoneService({ notificationId: 'cold', action: 'view' });
    const controller = createNotificationResponseController({
      notificationService: targetService(),
      phoneService: phone.phone,
      navigate,
      unlock: async () => true
    });

    await controller.start();
    await phone.emit({ notificationId: 'live', action: 'view' });
    controller.stop();

    expect(navigate).toHaveBeenNthCalledWith(1, '/transactions/transaction-1');
    expect(navigate).toHaveBeenNthCalledWith(2, '/transactions/transaction-1');
    expect(phone.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('dedupes identical cold and live response replay before routing', async () => {
    const navigate = jest.fn();
    const phone = phoneService({ notificationId: 'same', action: 'view' });
    const controller = createNotificationResponseController({
      notificationService: targetService(),
      phoneService: phone.phone,
      navigate,
      unlock: async () => true
    });

    await controller.start();
    await phone.emit({ notificationId: 'same', action: 'view' });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/transactions/transaction-1');
  });

  it('uses the fixed safe fallback even if a caller supplies an unsafe one', async () => {
    const navigate = jest.fn();
    const controller = createNotificationResponseController({
      notificationService: targetService({
        resolveTarget: jest.fn(async () => ({ status: 'unavailable' as const, target: null }))
      }),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true,
      fallbackDestination: 'https://example.test/?pin=1234'
    } as never);

    await controller.handle({ notificationId: 'missing', action: 'view' });

    expect(navigate).toHaveBeenCalledWith('/notifications');
  });

  it('unlocks before revalidating a protected edit and routes only after it is available', async () => {
    const order: string[] = [];
    const navigate = jest.fn(() => order.push('navigate'));
    const controller = createNotificationResponseController({
      notificationService: targetService({
        resolveTarget: jest.fn(async () => ({
          status: 'unlock_required' as const,
          target: { kind: 'obligation' as const, obligationId: 'obligation-1' }
        })),
        revalidateAction: jest.fn(async (_id, action) => {
          order.push('revalidate');
          return {
            status: 'available' as const,
            target: { kind: 'obligation' as const, obligationId: 'obligation-1' },
            action
          };
        })
      }),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => {
        order.push('unlock');
        return true;
      }
    });

    await controller.handle({ notificationId: 'protected', action: 'edit' });

    expect(order).toEqual(['unlock', 'revalidate', 'navigate']);
    expect(navigate).toHaveBeenCalledWith('/obligations/obligation-1/edit');
  });

  it('falls back instead of executing an expired action', async () => {
    const executeAction = jest.fn();
    const navigate = jest.fn();
    const controller = createNotificationResponseController({
      notificationService: targetService({
        revalidateAction: jest.fn(async (_id, action) => ({
          status: 'expired' as const,
          target: { kind: 'transaction' as const, transactionId: 'transaction-1' },
          action
        })),
        executeAction
      }),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true
    });

    await controller.handle({ notificationId: 'expired', action: 'undo' });

    expect(executeAction).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/notifications');
  });

  it('executes a protected undo once with a stable operation ID', async () => {
    const executeAction = jest.fn(async () => ({
      value: { id: 'undo', target: null },
      affectedScopes: []
    }));
    const controller = createNotificationResponseController({
      notificationService: targetService({ executeAction }),
      phoneService: phoneService().phone,
      navigate: jest.fn(),
      unlock: async () => true
    });

    await Promise.all([
      controller.handle({ notificationId: 'undo', action: 'undo' }),
      controller.handle({ notificationId: 'undo', action: 'undo' })
    ]);

    expect(executeAction).toHaveBeenCalledTimes(1);
    expect(executeAction).toHaveBeenCalledWith('undo', 'undo', 'notification-response-undo-undo');
  });

  it('allows retry after a transient protected undo failure', async () => {
    const executeAction = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        value: { id: 'undo', target: null },
        affectedScopes: []
      });
    const navigate = jest.fn();
    const controller = createNotificationResponseController({
      notificationService: targetService({ executeAction }),
      phoneService: phoneService().phone,
      navigate,
      unlock: async () => true
    });

    await controller.handle({ notificationId: 'undo', action: 'undo' });
    await controller.handle({ notificationId: 'undo', action: 'undo' });

    expect(executeAction).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/notifications');
  });
});
