import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { RouteModalContainer } from '@/design-system/components/overlays/RouteModalContainer';
import { AccountPicker } from '@/features/transactions/AccountPicker';
import {
  MANUAL_TRANSACTION_DRAFT_ID,
  patchManualTransactionDraft
} from '@/features/transactions/manual-transaction-draft';
import { translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

export default function AccountPickerRoute() {
  const { currencyCode, draft, field } = useLocalSearchParams<{
    currencyCode?: string;
    draft?: string;
    field?: 'accountId' | 'destinationAccountId';
  }>();
  const manual = draft === 'manual';
  const target = field === 'destinationAccountId' ? field : 'accountId';
  const [selectedId, setSelectedId] = useState<string>();
  const [sourceAccountId, setSourceAccountId] = useState<string>();

  useEffect(() => {
    if (!manual) return;
    void coreFinanceService
      .loadDraft(MANUAL_TRANSACTION_DRAFT_ID)
      .then((value) => {
        setSourceAccountId(value?.accountId ?? undefined);
        setSelectedId(value?.[target] ?? undefined);
      });
  }, [manual, target]);

  return (
    <RouteModalContainer
      fullScreen={manual}
      title={translate('coreFinance.action.accounts')}
      closeLabel={translate('appShell.navigation.close')}
      onDismiss={() => router.back()}
    >
      <AccountPicker
        currencyCode={
          target === 'destinationAccountId' ? currencyCode : undefined
        }
        excludedIds={
          target === 'destinationAccountId' && sourceAccountId
            ? [sourceAccountId]
            : []
        }
        selectedId={selectedId}
        onSelect={(account) => {
          if (!manual) {
            router.back();
            return;
          }
          void patchManualTransactionDraft({ [target]: account.id }).then(() =>
            router.back()
          );
        }}
      />
    </RouteModalContainer>
  );
}
