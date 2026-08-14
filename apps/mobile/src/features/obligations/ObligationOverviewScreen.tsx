import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import type { Obligation } from '@/domain/financial-planning';
import { PlanningMetric, PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatAmount } from '@/utils/format-financial-value';
import { useObligationsOverview } from './obligation-queries';

export function ObligationOverviewScreen() {
  const query = useObligationsOverview();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const hidden = hideBalances && !revealed;
  const amount = (minor: number) => hidden ? translate('planning.state.hidden') : formatAmount(minor / 100, currencyCode, currentLocale());
  return (
    <PlanningScreen titleKey="planning.obligations.title" action={{ labelKey: 'planning.obligations.new', onPress: () => router.push('/obligations/new') }}>
      {query.isLoading ? <PlanningState state="loading" /> : query.isError ? <PlanningState state="error" onRetry={() => void query.refetch()} /> : !query.data?.items.length ? <PlanningState state="empty" /> : (
        <>
          <PlanningMetric labelKey="planning.obligation.payables" value={amount(query.data.payablesMinor)} />
          <PlanningMetric labelKey="planning.obligation.receivables" value={amount(query.data.receivablesMinor)} />
          <PlanningMetric labelKey="planning.field.nextDue" value={query.data.nextDueDate ?? translate('reports.state.unavailable')} />
          {query.data.items.map((item: Obligation) => (
            <SurfaceCard key={item.id}>
              <View>
                <StyledText variant="subtitle">{item.title}</StyledText>
                <StyledText>{translate(`planning.obligation.direction.${item.direction}` as MessageKey)}</StyledText>
                <StyledText>{translate(`planning.obligation.status.${item.status}` as MessageKey)}</StyledText>
                <ActionButton label={translate('planning.action.open')} onPress={() => router.push(`/obligations/${item.id}`)} variant="secondary" />
              </View>
            </SurfaceCard>
          ))}
        </>
      )}
    </PlanningScreen>
  );
}
