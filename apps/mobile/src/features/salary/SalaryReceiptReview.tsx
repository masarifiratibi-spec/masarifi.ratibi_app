import React, { useState } from 'react';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { localDateFromTimestamp } from '@/domain/financial-planning';
import { PlanningMetric, PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { translate, type MessageKey } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePlanningMutation, useSalaryOverview, useSalaryReceiptReview } from './salary-queries';

export function SalaryReceiptReview({ receiptId = '' }: { receiptId?: string }) {
  const today = localDateFromTimestamp(Date.now());
  const receipt = useSalaryReceiptReview(receiptId);
  const salary = useSalaryOverview(today);
  const [expectedDate, setExpectedDate] = useState(today);
  const [receivedDate, setReceivedDate] = useState(today);
  const [error, setError] = useState<string>();
  const confirm = usePlanningMutation((input: Parameters<typeof financialPlanningService.confirmSalaryReceipt>[0]) =>
    financialPlanningService.confirmSalaryReceipt(input, `salary-receipt:${receiptId}:${Date.now()}`)
  );
  const undo = usePlanningMutation((id: string) =>
    financialPlanningService.undoSalaryReceipt(id, `salary-receipt-undo:${id}:${Date.now()}`)
  );

  const confirmReceipt = () => {
    if (!salary.data?.profileId || !receiptId) {
      setError(translate('planning.state.error'));
      return;
    }
    confirm.mutate({
      salaryProfileId: salary.data.profileId,
      transactionId: receiptId,
      expectedOccurrenceDate: expectedDate,
      receivedDate
    }, { onError: () => setError(translate('planning.state.error')) });
  };

  return (
    <PlanningScreen titleKey="planning.salary.review">
      {!receiptId ? <PlanningState state="empty" /> : receipt.isLoading || salary.isLoading ? <PlanningState state="loading" /> : receipt.isError || salary.isError ? <PlanningState state="error" onRetry={() => { void receipt.refetch(); void salary.refetch(); }} /> : receipt.data ? (
        <>
          <PlanningMetric labelKey="planning.salary.transaction" value={receipt.data.transactionId} />
          <PlanningMetric labelKey="planning.salary.expectedDate" value={receipt.data.expectedOccurrenceDate} />
          <PlanningMetric labelKey="planning.salary.receivedDate" value={receipt.data.receivedDate} />
          <PlanningMetric labelKey="planning.field.status" value={translate(`planning.receipt.status.${receipt.data.status}` as MessageKey)} />
          {receipt.data.status !== 'undone' ? <ActionButton label={translate('planning.salary.undoReceipt')} loading={undo.isPending} onPress={() => undo.mutate(receipt.data!.id)} variant="secondary" /> : null}
        </>
      ) : (
        <>
          <StyledText>{translate('planning.salary.confirmReceipt')}</StyledText>
          <FormField label={translate('planning.salary.expectedDate')} onChangeText={(value) => setExpectedDate(value as typeof today)} value={expectedDate} />
          <FormField label={translate('planning.salary.receivedDate')} onChangeText={(value) => setReceivedDate(value as typeof today)} value={receivedDate} errorText={error} />
          <ActionButton label={translate('planning.salary.confirmReceipt')} loading={confirm.isPending} onPress={confirmReceipt} />
        </>
      )}
    </PlanningScreen>
  );
}
