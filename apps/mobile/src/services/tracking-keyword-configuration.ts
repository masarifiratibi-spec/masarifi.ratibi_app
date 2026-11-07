import type { KeywordRule } from '@/domain/app-shell';
import { useAppShellStore } from '@/state/app-shell';
import { automaticTrackingService } from './automatic-tracking-service';
import { TrackingError } from './contracts/automatic-tracking-service';
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
    previousRules: readonly KeywordRule[],
    onPersist?: (rules: KeywordRule[]) => void
  ): Promise<KeywordRule[]> {
    const owner = useAppShellStore.getState().session?.userId;
    await suspendAutomaticTrackingConfiguration(owner);
    if (useAppShellStore.getState().session?.userId !== owner)
      throw new Error('tracking_owner_changed');
    let savedRules: KeywordRule[];
    try {
      savedRules = (
        await automaticTrackingService.saveKeywordRules(rules, previousRules)
      ).value;
    } catch (error) {
      if (!(error instanceof TrackingError) || error.code !== 'conflict')
        throw error;
      if (useAppShellStore.getState().session?.userId !== owner)
        throw new Error('tracking_owner_changed');
      const current = await automaticTrackingService.listKeywordRules();
      if (useAppShellStore.getState().session?.userId !== owner)
        throw new Error('tracking_owner_changed');
      onPersist?.(current);
      await updateAutomaticTrackingKeywords(current, owner);
      throw error;
    }
    if (useAppShellStore.getState().session?.userId !== owner)
      throw new Error('tracking_owner_changed');
    onPersist?.(savedRules);
    await updateAutomaticTrackingKeywords(savedRules, owner);
    return savedRules;
  },
  async restore(
    onPersist?: (rules: KeywordRule[]) => void
  ): Promise<KeywordRule[]> {
    const owner = useAppShellStore.getState().session?.userId;
    await suspendAutomaticTrackingConfiguration(owner);
    if (useAppShellStore.getState().session?.userId !== owner)
      throw new Error('tracking_owner_changed');
    const result = await automaticTrackingService.restoreDefaultKeywords();
    if (useAppShellStore.getState().session?.userId !== owner)
      throw new Error('tracking_owner_changed');
    onPersist?.(result.value);
    await updateAutomaticTrackingKeywords(result.value, owner);
    return result.value;
  }
};
