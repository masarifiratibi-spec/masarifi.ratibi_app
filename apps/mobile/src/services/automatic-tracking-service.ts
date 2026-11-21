import { isFixtureModeEnabled } from '@/config/demo-mode';
import type { AutomaticTrackingService } from './contracts/automatic-tracking-service';
import type { CapabilityProviderHandle } from './contracts/capability-contract';
import { createLiveAutomaticTrackingService } from './live/automatic-tracking-service';

export function selectAutomaticTrackingService(
  fixtureMode: boolean,
  live: CapabilityProviderHandle<AutomaticTrackingService>
): CapabilityProviderHandle<AutomaticTrackingService> {
  if (!fixtureMode) return live;
  // Fixture generation is unnecessary during live startup.
  return (
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    require('./mocks/automatic-tracking-service') as typeof import('./mocks/automatic-tracking-service')
  ).automaticTrackingService;
}

export const automaticTrackingService = selectAutomaticTrackingService(
  isFixtureModeEnabled(),
  createLiveAutomaticTrackingService()
);
