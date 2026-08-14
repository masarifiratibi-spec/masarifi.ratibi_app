import React from 'react';

import { ActionButton } from '@/design-system/components/ActionButton';
import { PlanningMetric, PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { translate, type MessageKey } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { useObligationsOverview } from './obligation-queries';
import { usePaymentMatch, usePlanningMutation } from './payment-queries';

export function PaymentMatchReviewScreen({ matchId = '' }: { matchId?: string }) {
  const query = usePaymentMatch(matchId);
  const obligations = useObligationsOverview();
  const resolve = usePlanningMutation((input: Parameters<typeof financialPlanningService.resolvePaymentMatch>[0]) =>
    financialPlanningService.resolvePaymentMatch(input, `payment-match:${matchId}:${Date.now()}`)
  );
  return (
    <PlanningScreen titleKey="planning.obligations.match">
      {!matchId ? <PlanningState state="empty" /> : query.isLoading || obligations.isLoading ? <PlanningState state="loading" /> : query.isError || obligations.isError || !query.data ? <PlanningState state="error" onRetry={() => { void query.refetch(); void obligations.refetch(); }} /> : (
        <>
          <PlanningMetric labelKey="planning.field.status" value={translate(`planning.paymentMatch.status.${query.data.status}` as MessageKey)} />
          <PlanningMetric labelKey="planning.paymentMatch.transaction" value={query.data.transactionId ?? translate('reports.state.unavailable')} />
          {query.data.candidateObligationIds.map((obligationId: string) => <ActionButton key={obligationId} label={`${translate('planning.paymentMatch.confirm')}: ${obligations.data?.items.find((item: { id: string }) => item.id === obligationId)?.title ?? obligationId}`} loading={resolve.isPending} onPress={() => resolve.mutate({ matchId, obligationId, action: 'confirm' })} />)}
          <ActionButton label={translate('planning.paymentMatch.ignore')} loading={resolve.isPending} onPress={() => resolve.mutate({ matchId, obligationId: null, action: 'ignore' })} variant="secondary" />
        </>
      )}
    </PlanningScreen>
  );
}
