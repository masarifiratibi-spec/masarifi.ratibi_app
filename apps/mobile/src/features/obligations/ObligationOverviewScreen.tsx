import React from 'react';
import { router } from 'expo-router';

import { FinancialPulse } from '@/design-system/components/financial/FinancialPulse';
import { GroupedList, NavigationRow } from '@/design-system/components/navigation/GroupedList';
import type { Obligation } from '@/domain/financial-planning';
import { PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useObligationsOverview } from './obligation-queries';

export function ObligationOverviewScreen() {
  const query = useObligationsOverview();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const hidden = hideBalances && !revealed;
  const amount = (minor: number) => hidden ? translate('planning.state.hidden') : formatMinorAmount(minor, currencyCode, currentLocale());
  return (
    <PlanningScreen titleKey="planning.obligations.title" action={{ labelKey: 'planning.obligations.new', onPress: () => router.push('/obligations/new') }}>
      {query.isLoading ? <PlanningState state="loading" /> : query.isError ? <PlanningState state="error" onRetry={() => void query.refetch()} /> : !query.data?.items.length ? <PlanningState state="empty" /> : (
        <>
          <FinancialPulse
            accessibilityLabel={`${translate('planning.obligation.totalPayable')}, ${amount(query.data.payablesMinor)}, ${query.data.nextDueDate ?? translate('reports.state.unavailable')}`}
            scope={translate('planning.obligation.totalPayable')}
            statement={amount(query.data.payablesMinor)}
            supportingValue={query.data.nextDueDate ?? translate('reports.state.unavailable')}
          />
          <GroupedList label={translate('planning.obligations.title')}>
            {query.data.items.map((item: Obligation) => (
              <NavigationRow
                key={item.id}
                label={item.title}
                description={`${translate(`planning.obligation.direction.${item.direction}` as MessageKey)} · ${translate(`planning.obligation.status.${item.status}` as MessageKey)}`}
                value={item.contractedTotalMinor === null ? translate('reports.state.unavailable') : amount(item.contractedTotalMinor)}
                onPress={() => router.push(`/obligations/${item.id}`)}
              />
            ))}
          </GroupedList>
        </>
      )}
    </PlanningScreen>
  );
}
