const mockProfileScreenLoaded = jest.fn();
jest.mock('./ProfileSetupScreen', () => {
  mockProfileScreenLoaded();
  return { ProfileSetupScreen: () => null };
});

it('defers the profile setup screen until its route is rendered', () => {
  const Route = jest.requireActual<
    typeof import('../../../app/(onboarding)/profile-setup')
  >('../../../app/(onboarding)/profile-setup').default;
  expect(mockProfileScreenLoaded).not.toHaveBeenCalled();
  expect(Route().type).toBe(
    jest.requireMock<typeof import('./ProfileSetupScreen')>(
      './ProfileSetupScreen'
    ).ProfileSetupScreen
  );
  expect(mockProfileScreenLoaded).toHaveBeenCalledTimes(1);
});
