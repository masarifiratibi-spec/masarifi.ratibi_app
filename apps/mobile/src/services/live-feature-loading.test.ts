const mockAssistantFixtureLoaded = jest.fn();
const mockNotificationFixtureLoaded = jest.fn();
const mockSupportFixtureLoaded = jest.fn();
let mockFixtureMode = false;

jest.mock('@/config/demo-mode', () => ({
  ...jest.requireActual('@/config/demo-mode'),
  isDemoModeEnabled: () => false,
  isFixtureModeEnabled: () => mockFixtureMode
}));
jest.mock('./mocks/assistant-service', () => {
  mockAssistantFixtureLoaded();
  return jest.requireActual('./mocks/assistant-service');
});
jest.mock('./mocks/assistant-notifications-service', () => {
  mockNotificationFixtureLoaded();
  return jest.requireActual('./mocks/assistant-notifications-service');
});
jest.mock('./mocks/support-service', () => {
  mockSupportFixtureLoaded();
  return jest.requireActual('./mocks/support-service');
});

it('selects live assistant without initializing its fixture graph', () => {
  const service = jest.requireActual<typeof import('./assistant-service')>(
    './assistant-service'
  );
  expect(service.assistantService.metadata.kind).toBe('live');
  expect(mockAssistantFixtureLoaded).not.toHaveBeenCalled();
});

it('selects live notification and support services without initializing their fixture graphs', () => {
  const service = jest.requireActual<typeof import('./engagement-service')>(
    './engagement-service'
  );
  expect(service.notificationService.metadata.kind).toBe('live');
  expect(service.supportService.metadata.kind).toBe('live');
  expect(mockNotificationFixtureLoaded).not.toHaveBeenCalled();
  expect(mockSupportFixtureLoaded).not.toHaveBeenCalled();
});

it('retains live availability selection without loading fixture services', () => {
  const service = jest.requireActual<typeof import('./assistant-service')>(
    './assistant-service'
  );
  const available = {
    ...service.assistantService,
    metadata: {
      ...service.assistantService.metadata,
      availability: 'available' as const
    }
  };
  expect(service.selectAssistantService(false, available)).toBe(available);
  expect(
    service.selectAssistantService(false, {
      ...available,
      metadata: { ...available.metadata, availability: 'unavailable' }
    }).metadata
  ).toMatchObject({
    id: 'unavailable-assistant',
    availability: 'unavailable',
    kind: 'live'
  });
  expect(mockAssistantFixtureLoaded).not.toHaveBeenCalled();
});

it('still selects the existing assistant fixture when explicitly requested', () => {
  const service = jest.requireActual<typeof import('./assistant-service')>(
    './assistant-service'
  );
  const fixture = jest.requireMock<typeof import('./mocks/assistant-service')>(
    './mocks/assistant-service'
  );
  expect(service.selectAssistantService(true, service.assistantService)).toBe(
    fixture.assistantService
  );
});

it('retains the existing notification and support fixture singletons in fixture mode', () => {
  mockFixtureMode = true;
  try {
    jest.isolateModules(() => {
      const service = jest.requireActual<typeof import('./engagement-service')>(
        './engagement-service'
      );
      expect(service.notificationService).toBe(
        jest.requireMock('./mocks/assistant-notifications-service')
          .assistantNotificationsService
      );
      expect(service.supportService).toBe(
        jest.requireMock('./mocks/support-service').supportService
      );
    });
  } finally {
    mockFixtureMode = false;
  }
});
