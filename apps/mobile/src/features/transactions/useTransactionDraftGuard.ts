import { translate } from '@/localization/i18n';
import { useDraftNavigationGuard } from '@/features/shell/useDraftNavigationGuard';

export function useTransactionDraftGuard({
  meaningful,
  discard,
  close
}: {
  meaningful: boolean;
  discard: () => Promise<void>;
  close?: () => void;
}) {
  return useDraftNavigationGuard({
    dirty: meaningful,
    discard,
    close,
    copy: {
      title: translate('coreFinance.draft.leaveTitle'),
      message: translate('coreFinance.draft.leaveMessage'),
      keep: translate('coreFinance.draft.keepEditing'),
      discard: translate('coreFinance.draft.discard')
    }
  });
}
