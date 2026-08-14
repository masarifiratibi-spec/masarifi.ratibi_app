import React from 'react';
import { router } from 'expo-router';

import type { Calculation } from '@/domain/financial-planning';
import type { MoneyValue } from '@/domain/core-finance';
import { localDateFromTimestamp } from '@/domain/financial-planning';
import { PlanningMetric, PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatAmount } from '@/utils/format-financial-value';
import { useSalaryOverview } from './salary-queries';

export function SalaryOverviewScreen() {
  const query = useSalaryOverview(localDateFromTimestamp(Date.now()));
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const money = (calculation: Calculation<MoneyValue>) =>
    calculation.status === 'unavailable'
      ? calculation.reason
      : hideBalances && !revealed
        ? translate('planning.state.hidden')
        : formatAmount(calculation.value.minorUnits / 100, calculation.value.currencyCode, currentLocale());

  return (
    <PlanningScreen titleKey="planning.salary.title" action={{ labelKey: 'planning.salary.setup', onPress: () => router.push('/salary/profile') }}>
      {query.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError || !query.data ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : query.data.dataState === 'empty' ? (
        <PlanningState state="empty" />
      ) : (
        <>
          <PlanningMetric labelKey="planning.salary.income" value={money(query.data.income)} />
          <PlanningMetric labelKey="planning.salary.expenses" value={money(query.data.expenses)} />
          <PlanningMetric labelKey="planning.salary.reserved" value={money(query.data.reservedObligations)} />
          <PlanningMetric labelKey="planning.field.remaining" value={money(query.data.remaining)} />
          <PlanningMetric labelKey="planning.salary.daily" value={money(query.data.suggestedDaily)} />
          <PlanningMetric labelKey="planning.field.nextDue" value={query.data.projectedNextSalaryDate ?? translate('reports.state.unavailable')} />
          <PlanningMetric labelKey="planning.field.status" value={translate(`planning.salary.status.${query.data.salaryState}` as MessageKey)} />
        </>
      )}
    </PlanningScreen>
  );
}
