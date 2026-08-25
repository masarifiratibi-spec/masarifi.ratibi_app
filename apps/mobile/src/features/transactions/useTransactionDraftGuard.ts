import { translate } from '@/localization/i18n';
import { useDraftNavigationGuard } from '@/features/shell/useDraftNavigationGuard';

export function useTransactionDraftGuard({
  meaningful,
  discard
}: {
  meaningful: boolean;
  discard: () => Promise<void>;
}) {
  return useDraftNavigationGuard({
    dirty: meaningful,
    discard,
    copy: {
      title: translate('coreFinance.draft.leaveTitle'),
      message: translate('coreFinance.draft.leaveMessage'),
      keep: translate('coreFinance.draft.keepEditing'),
      discard: translate('coreFinance.draft.discard')
    }
  }).requestClose;
}
