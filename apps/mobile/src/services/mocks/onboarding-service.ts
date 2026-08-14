import type { OnboardingProgress } from '@/domain/app-shell';
import {
  onboardingServiceCapability,
  type OnboardingService
} from '@/services/contracts/app-shell-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import { resumeOnboardingStep } from '@/features/onboarding/onboarding-progress';

export function createMockOnboardingService(): CapabilityProviderHandle<OnboardingService> {
  let progress: OnboardingProgress | null = null;
  return {
    metadata: {
      id: 'mock-onboarding',
      capability: onboardingServiceCapability.capability,
      majorVersion: onboardingServiceCapability.majorVersion,
      kind: 'mock',
      availability: 'available'
    },
    async loadProgress() {
      return progress
        ? {
            ...progress,
            currentStep: resumeOnboardingStep(progress)
          }
        : null;
    },
    async saveProgress(next) {
      progress = {
        ...next,
        currentStep: resumeOnboardingStep(next)
      };
    },
    async resetProgress() {
      progress = null;
    }
  };
}
