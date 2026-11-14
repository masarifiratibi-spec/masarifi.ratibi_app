const mockScenarioLoaded = jest.fn();

jest.mock('./FrontendQualityScenarioScreen', () => {
  mockScenarioLoaded();
  return {
    FrontendQualityScenarioScreen: () => null,
    FrontendQualityScenarioUnavailableScreen: () => null
  };
});

it('does not initialize scenario fixtures during route discovery', () => {
  jest.requireActual('../../../app/foundation/scenarios');
  expect(mockScenarioLoaded).not.toHaveBeenCalled();
});
