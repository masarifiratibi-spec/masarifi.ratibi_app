import type { KeywordRule } from '@/domain/app-shell';
import { useAppShellStore } from '@/state/app-shell';
import { automaticTrackingService } from './automatic-tracking-service';
import {
  suspendAutomaticTrackingConfiguration,
  updateAutomaticTrackingKeywords
} from './automatic-tracking-coordinator';

// Every editor uses the live capability, including onboarding. The fixture
// capability provides its own local persistence when running in demo mode.
export const trackingKeywordConfiguration = {
  load: () => automaticTrackingService.listKeywordRules(),
  async save(
    rules: readonly KeywordRule[],
    onPersist?: (rules: KeywordRule[]) => void
  ): Promise<KeywordRule[]> {
    const owner = useAppShellStore.getState().session?.userId;
    await suspendAutomaticTrackingConfiguration(owner);
    const result = await automaticTrackingService.saveKeywordRules(rules);
    if (useAppShellStore.getState().session?.userId !== owner)
      throw new Error('tracking_owner_changed');
    onPersist?.(result.value);
    await updateAutomaticTrackingKeywords(result.value, owner);
    return result.value;
  },
  async restore(
    onPersist?: (rules: KeywordRule[]) => void
  ): Promise<KeywordRule[]> {
    const owner = useAppShellStore.getState().session?.userId;
    await suspendAutomaticTrackingConfiguration(owner);
    const result = await automaticTrackingService.restoreDefaultKeywords();
    if (useAppShellStore.getState().session?.userId !== owner)
      throw new Error('tracking_owner_changed');
    onPersist?.(result.value);
    await updateAutomaticTrackingKeywords(result.value, owner);
    return result.value;
  }
};
