const mockFixtureLoaded = jest.fn();
jest.mock('@/config/demo-mode', () => ({ isFixtureModeEnabled: () => false }));
jest.mock('./mocks/automatic-tracking-service', () => {
  mockFixtureLoaded();
  return { automaticTrackingService: { metadata: { kind: 'mock' } } };
});

it('selects live tracking without initializing the fixture service graph', () => {
  const service = jest.requireActual<
    typeof import('./automatic-tracking-service')
  >('./automatic-tracking-service');
  expect(service.automaticTrackingService.metadata.kind).toBe('live');
  expect(mockFixtureLoaded).not.toHaveBeenCalled();
});
