import React from 'react';
import { HomeScreen } from '@/features/home/HomeScreen';
import { ProfileCompletionCard } from '@/features/onboarding/ProfileCompletionCard';
import {
  deriveProfileCompletionSteps,
  emptyProfileSummary
} from '@/features/onboarding/profile-completion';
import { PlanningHomeCard } from '@/features/financial-planning/PlanningHomeCard';
import { TrackingHomeCard } from '@/features/tracking/TrackingHomeCard';
import { useAppShellStore } from '@/state/app-shell';

export default function HomeRoute() {
  const dismissed = useAppShellStore((state) => state.profilePromptDismissed);
  const dismissProfilePrompt = useAppShellStore(
    (state) => state.dismissProfilePrompt
  );
  return (
    <HomeScreen
      footer={
        <>
          <PlanningHomeCard />
          <TrackingHomeCard />
          {dismissed ? null : (
            <ProfileCompletionCard
              onDismiss={dismissProfilePrompt}
              steps={deriveProfileCompletionSteps(emptyProfileSummary)}
            />
          )}
        </>
      }
    />
  );
}
