import {
  createNotificationPreferences,
  notificationCategorySchema
} from '@/domain/notifications';
import type { SupportDraft } from '@/domain/support';
import { useAppShellStore } from '@/state/app-shell';
import * as SecureStore from 'expo-secure-store';
import {
  getLiveClerkToken,
  registerLiveClerkBridge,
  type LiveClerkBridge
} from './auth-service';
import {
  createLiveNotificationService,
  createEngagementApi,
  createLiveSupportService,
  ensureLivePushDeviceRegistration
} from './engagement-service';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

beforeEach(() => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
});

const id = (suffix: number) =>
  `11000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const at = '2026-09-10T08:00:00.000Z';
jest.mock('@/config/mobile-automation', () => ({
  isMobileAutomationEnabled: jest.fn(() => false)
}));

it.each([
  [true, '/api/v1/tracking/device/notifications'],
  [false, '/api/v1/notifications']
])(
  'uses the isolated notification lane only when exact DEV gating is %s',
  async (development, prefix) => {
    const gate = jest.requireMock('@/config/mobile-automation')
      .isMobileAutomationEnabled as jest.Mock;
    gate.mockReturnValue(development);
    const trackingId = '78c71e06-457f-4f20-95f6-9db73c114a73';
    const storedDevice = jest
      .spyOn(SecureStore, 'getItemAsync')
      .mockResolvedValue(trackingId);
    const request = jest.fn(async () =>
      response({})
    ) as unknown as jest.MockedFunction<typeof fetch>;
    const api = createEngagementApi({
      baseUrl: 'https://api.example.test',
      token: async () => 'token',
      request
    });
    try {
      await api.listNotifications({ unread: true });
      await api.getNotification(id(7));
      await api.markNotificationRead(id(7), 2, 'read-7');
      await api.actOnNotification(id(7), 'view', 2, 'view-7');
      await api.getPreferences();
      await api.registerDevice(
        {
          deviceFingerprint: 'owned-installation-fingerprint',
          platform: 'android',
          appVersion: '1.0.0',
          pushToken: 'ExponentPushToken[owned]',
          pushProvider: 'expo'
        },
        'register-7'
      );
      expect(request.mock.calls.map(([url]) => String(url))).toEqual([
        `https://api.example.test${prefix}?limit=50&unread=true`,
        `https://api.example.test${prefix}/${id(7)}`,
        `https://api.example.test${prefix}/${id(7)}/read`,
        `https://api.example.test${prefix}/${id(7)}/actions`,
        'https://api.example.test/api/v1/notifications/preferences',
        `https://api.example.test${development ? '/api/v1/tracking/device/devices/register' : '/api/v1/me/devices/register'}`
      ]);
      expect(
        request.mock.calls.map(
          ([, options]) =>
            (options?.headers as Record<string, string>)[
              'x-masarifi-client-variant'
            ]
        )
      ).toEqual([...Array(6).fill(undefined)]);
      const registration = JSON.parse(String(request.mock.calls[5][1]?.body));
      if (development) expect(registration.trackingDeviceId).toBe(trackingId);
      else expect(registration).not.toHaveProperty('trackingDeviceId');
    } finally {
      storedDevice.mockRestore();
      gate.mockReturnValue(false);
    }
  }
);

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function notification(
  suffix: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: id(suffix),
    type: 'transaction.created',
    title: 'Transaction detected',
    body: 'Review the detected transaction.',
    dataSafe: { targetKind: 'transaction', targetId: id(90) },
    readAt: null,
    actedAt: null,
    expiresAt: '2026-09-11T08:00:00.000Z',
    actions: [{ key: 'view', expiresAt: '2026-09-10T09:00:00.000Z' }],
    version: 1,
    createdAt: at,
    ...overrides
  };
}

function ticket(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: id(20),
    categoryId: id(21),
    subject: 'Card payment needs review',
    status: 'waiting_support',
    priority: 'high',
    lastMessageAt: at,
    closedAt: null,
    version: 2,
    createdAt: at,
    messages: [
      {
        id: id(22),
        senderType: 'customer',
        body: 'Please review the receipt.',
        attachments: [
          {
            id: id(23),
            filename: 'receipt.png',
            contentType: 'image/png',
            sizeBytes: 2048,
            status: 'clean'
          }
        ],
        createdAt: at
      }
    ],
    nextCursor: null,
    hasMore: false,
    ...overrides
  };
}

it('decodes notification enums/actions strictly and uses each action expiry', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(
      response({
        items: [notification(1)],
        nextCursor: null,
        hasMore: false,
        unreadCount: 1
      })
    )
    .mockResolvedValueOnce(
      response({
        items: [
          notification(2, { actions: [{ key: 'archive', expiresAt: null }] })
        ],
        nextCursor: null,
        hasMore: false,
        unreadCount: 1
      })
    )
    .mockResolvedValueOnce(
      response({
        items: [notification(3, { type: 'mystery.created' })],
        nextCursor: null,
        hasMore: false,
        unreadCount: 1
      })
    ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveNotificationService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request
  });

  const page = await service.list({});
  expect(page.items[0]?.availableActions).toEqual([
    {
      kind: 'view',
      expiresAt: Date.parse('2026-09-10T09:00:00.000Z'),
      sourceVersion: null
    }
  ]);
  await expect(service.list({})).rejects.toBeDefined();
  await expect(service.list({})).rejects.toBeDefined();
});

it('maps transfer.created to the transaction category and target', async () => {
  const transferId = id(91);
  const request = jest.fn().mockResolvedValue(
    response({
      items: [
        notification(4, {
          type: 'transfer.created',
          dataSafe: { targetKind: 'transaction', targetId: transferId }
        })
      ],
      nextCursor: null,
      hasMore: false,
      unreadCount: 1
    })
  ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveNotificationService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request
  });

  await expect(service.list({})).resolves.toMatchObject({
    items: [
      {
        category: 'transaction',
        eventType: 'transfer.created',
        target: { kind: 'transaction', transactionId: transferId }
      }
    ]
  });
});

it.each([
  ['reminder.app_inactive.3d', 'app_inactivity', 'home'],
  ['reminder.app_inactive.7d', 'app_inactivity', 'home'],
  ['reminder.financial_inactive.7d', 'financial_activity', 'tracking']
] as const)(
  'maps %s to %s and its existing destination',
  async (type, category, targetKind) => {
    const request = jest.fn().mockResolvedValue(
      response({
        items: [
          notification(5, { type, dataSafe: { targetKind, targetId: null } })
        ],
        nextCursor: null,
        hasMore: false,
        unreadCount: 1
      })
    ) as unknown as jest.MockedFunction<typeof fetch>;
    const service = createLiveNotificationService({
      baseUrl: 'https://api.example.test',
      token: async () => 'token',
      request
    });

    await expect(service.list({})).resolves.toMatchObject({
      items: [{ category, target: { kind: targetKind } }]
    });
  }
);

it.each(['onboarding', 'add_transaction'])(
  'resolves authoritative DEV %s reminders only within their scope',
  async (targetKind) => {
    const gate = jest.requireMock('@/config/mobile-automation')
      .isMobileAutomationEnabled as jest.Mock;
    const request = jest
      .fn()
      .mockResolvedValue(
        response({
          items: [
            notification(8, {
              type:
                targetKind === 'onboarding'
                  ? 'reminder.onboarding_incomplete.1d'
                  : 'reminder.first_transaction.1d',
              dataSafe: { scope: 'dev_reminder', targetKind }
            })
          ],
          nextCursor: null,
          hasMore: false,
          unreadCount: 1
        })
      ) as unknown as jest.MockedFunction<typeof fetch>;
    const service = createLiveNotificationService({
      baseUrl: 'https://api.example.test',
      token: async () => 'token',
      request
    });
    gate.mockReturnValue(true);
    try {
      await expect(service.list({})).resolves.toMatchObject({
        items: [{ target: { kind: targetKind } }]
      });
    } finally {
      gate.mockReturnValue(false);
    }
    await expect(service.list({})).rejects.toThrow();
  }
);

it('traverses every unread notification page before marking all read', async () => {
  const request = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST')
        return response(notification(url.includes(id(1)) ? 1 : 2));
      if (url.includes('cursor=next'))
        return response({
          items: [notification(2)],
          nextCursor: null,
          hasMore: false,
          unreadCount: 2
        });
      return response({
        items: [notification(1)],
        nextCursor: 'next',
        hasMore: true,
        unreadCount: 2
      });
    }
  ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveNotificationService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request
  });

  await expect(service.markAllRead({}, 'mark-all')).resolves.toMatchObject({
    value: 2
  });
  expect(
    request.mock.calls.filter(([, init]) => init?.method === 'POST')
  ).toHaveLength(2);
  expect(
    request.mock.calls.some(([url]) => String(url).includes('cursor=next'))
  ).toBe(true);
});

it('returns the authoritative notification after marking it read', async () => {
  const readAt = '2026-09-10T08:45:00.000Z';
  const request = jest
    .fn()
    .mockResolvedValueOnce(response(notification(1)))
    .mockResolvedValueOnce(
      response({
        resourceId: id(1),
        outcome: 'success',
        currentState: 'read',
        version: 2,
        requestId: 'request-1'
      })
    )
    .mockResolvedValueOnce(
      response(notification(1, { version: 2, readAt }))
    ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveNotificationService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request
  });

  const mutation = await service.markRead(id(1), true);

  expect(mutation.value).toMatchObject({
    eventKey: `server:${id(1)}:2`,
    readAt: Date.parse(readAt)
  });
  expect(request).toHaveBeenCalledTimes(3);
});

it('round-trips the full preference matrix while retaining device-only settings', async () => {
  const local = {
    ...createNotificationPreferences(100),
    dailySummary: { enabled: true, time: '08:30' },
    weeklySummary: { enabled: true, weekday: 4, time: '10:15' },
    hideAmountsOnLockScreen: false,
    permissionState: 'granted' as const
  };
  const preferences = {
    getNotificationPreferences: jest.fn().mockResolvedValue(local),
    saveNotificationPreferences: jest.fn(async (value: unknown) => value)
  };
  const serverItems = notificationCategorySchema.options.map(
    (category, index) => ({
      channel: 'push',
      eventType: `${category}.event`,
      enabled: category !== 'budget',
      quietHours: {
        enabled: true,
        start: '23:00',
        end: '06:00',
        weekdays: [0, 1, 2, 3, 4],
        timeZone: 'Asia/Riyadh'
      },
      version: index + 1
    })
  );
  const request = jest
    .fn()
    .mockResolvedValueOnce(response({ items: serverItems, version: 6 }))
    .mockResolvedValueOnce(
      response({ items: serverItems, version: 7 })
    ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveNotificationService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request,
    preferences
  } as never);

  const loaded = await service.getPreferences();
  expect(loaded).toMatchObject({
    version: 6,
    phoneEnabled: true,
    categoryEnabled: { budget: false, transaction: true, system: true },
    dailySummary: local.dailySummary,
    weeklySummary: local.weeklySummary,
    hideAmountsOnLockScreen: false,
    permissionState: 'granted'
  });
  const input = {
    ...loaded,
    categoryEnabled: {
      ...loaded.categoryEnabled,
      budget: true,
      security: false
    }
  };
  const saved = await service.savePreferences(input, 6, 'preferences-6');
  expect(saved.value.version).toBe(7);
  const putBody = JSON.parse(
    String((request.mock.calls[1]?.[1] as RequestInit).body)
  ) as {
    items: { eventType: string; enabled: boolean }[];
  };
  expect(
    putBody.items.find((item) => item.eventType === 'budget.event')?.enabled
  ).toBe(true);
  expect(
    putBody.items.find((item) => item.eventType === 'security.event')?.enabled
  ).toBe(false);
  expect(preferences.saveNotificationPreferences).toHaveBeenCalled();
});

it.each(['configured', 'unset'] as const)(
  'loads every seeded backend event type with %s quiet hours',
  async (quietHoursState) => {
    const eventTypes = [
      'account.credit_card_payment_due',
      'transaction.created',
      'transfer.created',
      'transaction.refunded',
      'transaction.reversed',
      'transaction.revised',
      'transaction.deleted',
      'transaction.restored',
      'balance.changed',
      'ledger.reconciliation_failed',
      'planning.salary_receipt_expected',
      'planning.salary_receipt_received',
      'planning.obligation_overdue',
      'planning.obligation_completed',
      'planning.savings_goal_completed',
      'tracking.review.requested.v1',
      'tracking.duplicate.detected.v1',
      'unsupported.format.recorded.v1',
      'voice.proposal_ready.v1',
      'assistant.response_ready.v1',
      'ai.budget_threshold.v1',
      'report.ready',
      'report.delivery_failed',
      'export.ready'
    ];
    const request = jest.fn().mockResolvedValue(
      response({
        items: eventTypes.map((eventType, index) => ({
          channel: 'push',
          eventType,
          enabled: true,
          quietHours:
            quietHoursState === 'unset'
              ? {}
              : {
                  enabled: false,
                  start: '22:00',
                  end: '07:00',
                  weekdays: [0, 1, 2, 3, 4, 5, 6],
                  timeZone: 'Asia/Riyadh'
                },
          version: index + 1
        })),
        version: 23
      })
    ) as unknown as jest.MockedFunction<typeof fetch>;
    const service = createLiveNotificationService({
      baseUrl: 'https://api.example.test',
      token: async () => 'token',
      request,
      preferences: {
        getNotificationPreferences: jest
          .fn()
          .mockResolvedValue(createNotificationPreferences(1)),
        saveNotificationPreferences: jest.fn()
      }
    } as never);

    await expect(service.getPreferences()).resolves.toMatchObject({
      version: 23,
      phoneEnabled: true,
      quietHours: { enabled: false }
    });
  }
);

it.each([{ enabled: true }, { unexpected: true }])(
  'rejects malformed quiet hours instead of silently disabling them: %j',
  async (quietHours) => {
    const service = createLiveNotificationService({
      baseUrl: 'https://api.example.test',
      token: async () => 'token',
      request: jest.fn().mockResolvedValue(
        response({
          items: [
            {
              channel: 'push',
              eventType: 'transaction.created',
              enabled: true,
              quietHours,
              version: 1
            }
          ],
          version: 1
        })
      ) as unknown as typeof fetch,
      preferences: {
        getNotificationPreferences: jest
          .fn()
          .mockResolvedValue(createNotificationPreferences(1)),
        saveNotificationPreferences: jest.fn()
      }
    });
    await expect(service.getPreferences()).rejects.toBeDefined();
  }
);

it('does not erase device-only preferences when local storage fails', async () => {
  const storageFailure = new Error('database_locked');
  const service = createLiveNotificationService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request: jest.fn().mockResolvedValue(
      response({
        items: [],
        version: 1
      })
    ) as unknown as jest.MockedFunction<typeof fetch>,
    preferences: {
      getNotificationPreferences: jest.fn().mockRejectedValue(storageFailure),
      saveNotificationPreferences: jest.fn()
    }
  } as never);

  await expect(service.getPreferences()).rejects.toBe(storageFailure);
});

it('connects permission education to native registration and the owner device endpoint', async () => {
  const phone = {
    getPermission: jest.fn().mockResolvedValue('denied'),
    requestPermission: jest.fn().mockResolvedValue('granted'),
    registerCategories: jest.fn().mockResolvedValue(undefined)
  };
  const registration = {
    deviceFingerprint: '11000000-0000-4000-8000-000000000099',
    platform: 'android' as const,
    appVersion: '0.0.1',
    pushToken: 'ExponentPushToken[device-registration]',
    pushProvider: 'expo' as const
  };
  const request = jest
    .fn()
    .mockResolvedValue(
      response({ deviceId: id(99), registeredAt: at, version: 1 })
    ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveNotificationService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request,
    phone,
    pushRegistration: async () => registration
  } as never);

  await expect(service.refreshPermission()).resolves.toBe('denied');
  await expect(service.requestPermissionAfterEducation()).resolves.toBe(
    'granted'
  );
  expect(phone.registerCategories).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/me/devices/register',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Idempotency-Key': expect.not.stringContaining('device-registration')
      }),
      body: JSON.stringify(registration)
    })
  );
});

it('registers an already-permitted push device without requesting permission', async () => {
  const phone = {
    getPermission: jest.fn().mockResolvedValue('granted'),
    registerCategories: jest.fn().mockResolvedValue(undefined)
  };
  const registration = {
    deviceFingerprint: '11000000-0000-4000-8000-000000000099',
    platform: 'android' as const,
    appVersion: '0.0.1',
    pushToken: 'ExponentPushToken[existing-permission]',
    pushProvider: 'expo' as const
  };
  const request = jest
    .fn()
    .mockResolvedValue(
      response({ deviceId: id(99), registeredAt: at, version: 1 })
    ) as unknown as jest.MockedFunction<typeof fetch>;

  await expect(
    ensureLivePushDeviceRegistration({
      baseUrl: 'https://api.example.test',
      token: async () => 'token',
      request,
      phone,
      pushRegistration: async () => registration
    })
  ).resolves.toBe('granted');

  expect(phone.getPermission).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(1);
});

it('does not register a push device when permission is denied', async () => {
  const request = jest.fn();
  const pushRegistration = jest.fn();

  await expect(
    ensureLivePushDeviceRegistration({
      baseUrl: 'https://api.example.test',
      token: async () => 'token',
      request: request as never,
      phone: {
        getPermission: jest.fn().mockResolvedValue('denied'),
        registerCategories: jest.fn()
      },
      pushRegistration
    })
  ).resolves.toBe('denied');

  expect(pushRegistration).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

it.each(['device', 'identity'] as const)(
  'does not register a stale device after the account changes during %s lookup',
  async (phase) => {
    const original = useAppShellStore.getState().session;
    useAppShellStore.setState({
      session: { status: 'authenticated', userId: 'push-owner-a' } as never
    });
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const registration = {
      deviceFingerprint: '11000000-0000-4000-8000-000000000099',
      platform: 'android' as const,
      appVersion: '0.0.1',
      pushToken: 'ExponentPushToken[owner-a]',
      pushProvider: 'expo' as const
    };
    const request = jest
      .fn()
      .mockResolvedValue(
        response({ deviceId: id(99), registeredAt: at, version: 1 })
      );
    try {
      const operation = ensureLivePushDeviceRegistration({
        baseUrl: 'https://api.example.test',
        phone: {
          getPermission: async () => 'granted',
          registerCategories: async () => undefined
        },
        pushRegistration: async () => {
          if (phase === 'device') {
            entered();
            await pending;
          }
          return registration;
        },
        token: async () => {
          if (phase === 'identity') {
            entered();
            await pending;
          }
          return 'owner-b-token';
        },
        request
      }).catch(() => 'rejected');
      await started;
      useAppShellStore.setState({
        session: { status: 'authenticated', userId: 'push-owner-b' } as never
      });
      release();
      expect(await operation).not.toBe('granted');
      expect(request).not.toHaveBeenCalled();
    } finally {
      release();
      useAppShellStore.setState({ session: original });
    }
  }
);

it.each([
  ['startup', 'device'],
  ['startup', 'identity'],
  ['startup', 'response'],
  ['education', 'device'],
  ['education', 'identity']
] as const)(
  'fences the real Clerk owner during %s registration when the shell still holds A (%s)',
  async (entry, phase) => {
    const original = useAppShellStore.getState().session;
    useAppShellStore.setState({
      session: { status: 'authenticated', userId: 'push-owner-a' } as never
    });
    let clerkOwner = 'push-owner-a';
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    registerLiveClerkBridge({
      getSession: async () => ({
        id: `session-${clerkOwner}`,
        userId: clerkOwner,
        method: 'google',
        issuedAt: 1,
        expiresAt: 9999999999999
      }),
      getToken: async () => {
        if (phase === 'identity') {
          entered();
          await pending;
        }
        return `token-${clerkOwner}`;
      },
      startPhone: jest.fn(),
      verifyPhone: jest.fn(),
      resendPhone: jest.fn(),
      signInWithGoogle: jest.fn(),
      reverifyConflict: jest.fn(),
      signOut: jest.fn()
    } satisfies LiveClerkBridge);
    const request = jest.fn(async () => {
      if (phase === 'response') {
        entered();
        await pending;
      }
      return response({ deviceId: id(99), registeredAt: at, version: 1 });
    });
    const options = {
      baseUrl: 'https://api.example.test',
      token: getLiveClerkToken,
      request,
      phone: {
        getPermission: async () => 'granted' as const,
        requestPermission: async () => 'granted' as const,
        registerCategories: async () => undefined
      },
      pushRegistration: async () => {
        if (phase === 'device') {
          entered();
          await pending;
        }
        return {
          deviceFingerprint: id(99),
          platform: 'android' as const,
          appVersion: '0.0.1',
          pushToken: 'ExponentPushToken[owner-a]',
          pushProvider: 'expo' as const
        };
      }
    };
    try {
      const operation = (
        entry === 'startup'
          ? ensureLivePushDeviceRegistration(options)
          : createLiveNotificationService(
              options
            ).requestPermissionAfterEducation()
      ).catch(() => 'rejected');
      await started;
      clerkOwner = 'push-owner-b';
      release();
      expect(await operation).not.toBe('granted');
      expect(request).toHaveBeenCalledTimes(phase === 'response' ? 1 : 0);
    } finally {
      release();
      useAppShellStore.setState({ session: original });
    }
  }
);

it.each([null, 'push-owner-b'])(
  'registers the real Clerk device only for the matching app-shell owner (%s)',
  async (shellOwner) => {
    const original = useAppShellStore.getState().session;
    useAppShellStore.setState({
      session: shellOwner
        ? ({ status: 'authenticated', userId: shellOwner } as never)
        : null
    });
    registerLiveClerkBridge({
      getSession: async () => ({
        id: 'session-b',
        userId: 'push-owner-b',
        method: 'google',
        issuedAt: 1,
        expiresAt: 9999999999999
      }),
      getToken: async () => 'token-b',
      startPhone: jest.fn(),
      verifyPhone: jest.fn(),
      resendPhone: jest.fn(),
      signInWithGoogle: jest.fn(),
      reverifyConflict: jest.fn(),
      signOut: jest.fn()
    } satisfies LiveClerkBridge);
    const request = jest
      .fn()
      .mockResolvedValue(
        response({ deviceId: id(99), registeredAt: at, version: 1 })
      );
    try {
      const outcome = await ensureLivePushDeviceRegistration({
        baseUrl: 'https://api.example.test',
        token: getLiveClerkToken,
        request,
        phone: {
          getPermission: async () => 'granted',
          registerCategories: async () => undefined
        },
        pushRegistration: async () => ({
          deviceFingerprint: id(99),
          platform: 'android',
          appVersion: '0.0.1',
          pushToken: 'ExponentPushToken[owner-b]',
          pushProvider: 'expo'
        })
      }).catch(() => 'rejected');
      if (shellOwner) {
        expect(outcome).toBe('granted');
        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0]?.[1]).toMatchObject({
          headers: { Authorization: 'Bearer token-b' }
        });
      } else {
        expect(outcome).not.toBe('granted');
        expect(request).not.toHaveBeenCalled();
      }
    } finally {
      useAppShellStore.setState({ session: original });
    }
  }
);

it('uses a fresh owned token after permission education rather than one captured before the dialog', async () => {
  const original = useAppShellStore.getState().session;
  useAppShellStore.setState({
    session: { status: 'authenticated', userId: 'push-owner-a' } as never
  });
  let permissionReturned = false;
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'session-a',
      userId: 'push-owner-a',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken: async () =>
      permissionReturned ? 'fresh-owner-token' : 'expired-during-dialog',
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  } satisfies LiveClerkBridge);
  const request = jest.fn(
    async (_url: string | URL | Request, init?: RequestInit) =>
      (init?.headers as Record<string, string>).Authorization ===
      'Bearer fresh-owner-token'
        ? response({ deviceId: id(99), registeredAt: at, version: 1 })
        : response({}, 401)
  );
  try {
    const service = createLiveNotificationService({
      baseUrl: 'https://api.example.test',
      token: getLiveClerkToken,
      request,
      phone: {
        getPermission: async () => 'granted',
        requestPermission: async () => {
          permissionReturned = true;
          return 'granted';
        },
        registerCategories: async () => undefined
      },
      pushRegistration: async () => ({
        deviceFingerprint: id(99),
        platform: 'android',
        appVersion: '0.0.1',
        pushToken: 'ExponentPushToken[owner-a]',
        pushProvider: 'expo'
      })
    });
    await expect(service.requestPermissionAfterEducation()).resolves.toBe(
      'granted'
    );
  } finally {
    useAppShellStore.setState({ session: original });
  }
});

it('preserves exact ticket status and attachment metadata and rejects unknown status', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(response(ticket()))
    .mockResolvedValueOnce(
      response(ticket({ status: 'queued_somewhere' }))
    ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveSupportService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request
  });

  const loaded = await service.getTicket(id(20));
  expect(loaded.status).toBe('waiting_support');
  expect(loaded.messages[0]).toMatchObject({
    id: id(22),
    attachments: [
      {
        id: id(23),
        filename: 'receipt.png',
        contentType: 'image/png',
        sizeBytes: 2048,
        status: 'clean'
      }
    ]
  });
  await expect(service.getTicket(id(20))).rejects.toBeDefined();
});

it('traverses every ticket-message cursor without dropping history', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(
      response(ticket({ nextCursor: 'messages-2', hasMore: true }))
    )
    .mockResolvedValueOnce(
      response(
        ticket({
          messages: [
            {
              id: id(24),
              senderType: 'admin',
              body: 'We are reviewing it.',
              attachments: [],
              createdAt: '2026-09-10T09:00:00.000Z'
            }
          ]
        })
      )
    ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveSupportService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request
  });

  const loaded = await service.getTicket(id(20));
  expect(loaded.messages.map((message) => message.id)).toEqual([
    id(22),
    id(24)
  ]);
  expect(request.mock.calls[1]?.[0]).toBe(
    `https://api.example.test/api/v1/support/tickets/${id(20)}?cursor=messages-2&limit=100`
  );
});

it('sends reply attachment IDs unchanged', async () => {
  const request = jest
    .fn()
    .mockResolvedValue(response(ticket())) as unknown as jest.MockedFunction<
    typeof fetch
  >;
  const service = createLiveSupportService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request
  });

  await service.reply(
    id(20),
    {
      description: 'Attached is the receipt.',
      attachmentUploadIds: [id(30)]
    } as never,
    2,
    'reply-2'
  );
  expect(
    JSON.parse(String((request.mock.calls[0]?.[1] as RequestInit).body))
  ).toEqual({
    body: 'Attached is the receipt.',
    attachmentUploadIds: [id(30)],
    expectedVersion: 2
  });
});

it.each(['ticket', 'feedback'] as const)(
  'sends the ordinary feedback selection as feedback from a %s draft and retains its replay identity',
  async (mode) => {
    const operationId = '77777777-7777-4777-8777-777777777777';
    const draft: SupportDraft = {
      id: 'support-draft-ticket',
      mode,
      category: 'feedback',
      subject: 'Product feedback',
      description: 'A suggestion from the ordinary contact form.',
      ticketId: null,
      context: null,
      status: 'draft',
      updatedAt: 1,
      submissionOperationId: operationId
    };
    const drafts = {
      saveDraft: jest.fn(),
      loadDraft: jest.fn().mockResolvedValue(draft),
      discardDraft: jest.fn()
    };
    const request = jest.fn().mockResolvedValue(response({ id: id(20) }));
    const service = createLiveSupportService({
      baseUrl: 'https://api.example.test',
      token: async () => 'token',
      request,
      drafts
    });

    await expect(service.submitDraft(draft.id, 'different-caller-id')).resolves.toMatchObject({
      value: { kind: 'feedback', operationId, ticketId: null }
    });
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/v1/feedback');
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe(operationId);
    expect(JSON.parse(String(options.body))).toEqual({
      type: 'other',
      subject: draft.subject,
      body: draft.description
    });
    expect(drafts.discardDraft).toHaveBeenCalledWith(draft.id);
  }
);

it('keeps the draft and refuses ticket submission when its category is unavailable', async () => {
  const draft = {
    id: 'draft-1',
    mode: 'ticket',
    category: 'missing_category',
    subject: 'Card payment needs review',
    description: 'Please review the card payment.',
    ticketId: null,
    context: null,
    attachmentUploadIds: [id(30)],
    status: 'draft',
    updatedAt: 1
  } as unknown as SupportDraft;
  const drafts = {
    saveDraft: jest.fn(),
    loadDraft: jest.fn().mockResolvedValue(draft),
    discardDraft: jest.fn()
  };
  const request = jest.fn().mockResolvedValueOnce(
    response({
      items: [
        {
          id: id(40),
          key: 'other',
          name: 'Other',
          sortOrder: 1,
          active: true,
          version: 1
        }
      ],
      nextCursor: null,
      hasMore: false
    })
  ) as unknown as jest.MockedFunction<typeof fetch>;
  const service = createLiveSupportService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request,
    drafts
  });

  await expect(
    service.submitDraft('draft-1', 'submit-1')
  ).rejects.toBeDefined();
  expect(drafts.discardDraft).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

it('submits a live support draft using the owner detail response and discards only after success', async () => {
  const draft = {
    id: 'draft-live',
    mode: 'ticket',
    category: 'technical',
    subject: 'Need help',
    description: 'Please help with this problem',
    ticketId: null,
    context: null,
    attachmentUploadIds: [],
    status: 'draft',
    updatedAt: 1
  } as SupportDraft;
  const drafts = {
    saveDraft: jest.fn(),
    loadDraft: jest.fn().mockResolvedValue(draft),
    discardDraft: jest.fn()
  };
  const request = jest
    .fn()
    .mockResolvedValueOnce(
      response({
        items: [
          {
            id: id(21),
            key: 'technical',
            name: 'Technical',
            sortOrder: 0,
            active: true,
            version: 1
          }
        ],
        nextCursor: null,
        hasMore: false
      })
    )
    .mockResolvedValueOnce(response(ticket()));
  const service = createLiveSupportService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request,
    drafts
  });
  await expect(
    service.submitDraft(draft.id, 'support-live-submit')
  ).resolves.toMatchObject({ value: { ticketId: id(20) } });
  expect(drafts.discardDraft).toHaveBeenCalledWith(draft.id);
});

it('keeps server success when local support cleanup fails and uses the persisted replay identity', async () => {
  const operationId = '77777777-7777-4777-8777-777777777777';
  const draft = {
    id: 'cleanup-draft',
    mode: 'ticket',
    category: 'technical',
    subject: 'Help',
    description: 'Cannot synchronize',
    ticketId: null,
    context: null,
    status: 'draft',
    updatedAt: 1,
    submissionOperationId: operationId
  } as SupportDraft;
  const drafts = {
    saveDraft: jest.fn(),
    loadDraft: jest.fn().mockResolvedValue(draft),
    discardDraft: jest.fn().mockRejectedValue(new Error('disk failure'))
  };
  const request = jest
    .fn()
    .mockResolvedValueOnce(
      response({
        items: [
          {
            id: id(21),
            key: 'technical',
            name: 'Technical',
            sortOrder: 0,
            active: true,
            version: 1
          }
        ],
        nextCursor: null,
        hasMore: false
      })
    )
    .mockResolvedValueOnce(response(ticket()));
  const service = createLiveSupportService({
    baseUrl: 'https://api.example.test',
    token: async () => 'token',
    request,
    drafts
  });
  await expect(
    service.submitDraft(draft.id, 'different-caller-id')
  ).resolves.toMatchObject({ value: { ticketId: id(20), operationId } });
  expect(
    new Headers(request.mock.calls[1][1].headers).get('Idempotency-Key')
  ).toBe(operationId);
});
