import React, { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import type { Account, Category } from '@/domain/core-finance';
import {
  useAccounts,
  useCategories
} from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { automaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { formatAmount } from '@/utils/format-financial-value';
import { currentLocale } from '@/localization/i18n';
import { trackingFieldLabel, trackingReasonSummary } from './tracking-display';
import {
  invalidateTrackingScopes,
  useReviewItem
} from './useAutomaticTracking';

export function ReviewDetail({ id }: { id: string }) {
  const client = useQueryClient();
  const query = useReviewItem(id);
  const accounts = useAccounts(true);
  const categories = useCategories(true);
  const [resolving, setResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState(false);
  if (query.isLoading)
    return (
      <StateView state="loading" title={translate('tracking.state.loading')} />
    );
  if (query.isError || !query.data)
    return (
      <StateView
        state="error"
        title={translate('tracking.review.missing')}
        actionLabel={translate('appShell.navigation.back')}
        onAction={() => router.back()}
      />
    );
  const item = query.data;
  async function resolve(action: 'confirm' | 'ignore' | 'report_wrong') {
    setResolving(true);
    setResolutionError(false);
    try {
      const result = await automaticTrackingService.resolveReview(item.id, {
        action
      });
      await invalidateTrackingScopes(client, result.affectedScopes);
      router.back();
    } catch {
      setResolutionError(true);
    } finally {
      setResolving(false);
    }
  }
  const proposed = item.proposedValues;
  const currency = stringValue(proposed.currencyCode) ?? 'SAR';
  const accountId = stringValue(proposed.accountId);
  const categoryId = stringValue(proposed.categoryId);
  const account = accounts.data?.find(
    (candidate: Account) => candidate.id === accountId
  );
  const category = categories.data?.find(
    (candidate: Category) => candidate.id === categoryId
  );
  const locale = currentLocale();
  const rows = [
    {
      label: translate('coreFinance.form.amount'),
      value:
        typeof proposed.amountMinor === 'number'
          ? formatAmount(proposed.amountMinor / 100, currency, locale)
          : translate('tracking.review.notDetected')
    },
    {
      label: translate('voice.review.merchant'),
      value:
        stringValue(proposed.merchant) ??
        translate('tracking.review.notDetected')
    },
    {
      label: translate('coreFinance.transaction.account'),
      value: account?.name ?? translate('tracking.review.notDetected')
    },
    {
      label: translate('coreFinance.transaction.category'),
      value: category
        ? locale === 'ar'
          ? category.labelAr
          : category.labelEn
        : translate('tracking.review.notDetected')
    }
  ];
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {translate('tracking.review.detail')}
      </StyledText>
      <SurfaceCard>
        <View style={styles.stack}>
          <StyledText variant="subtitle">
            {trackingReasonSummary(item.reasonCodes)}
          </StyledText>
          {rows.map((row) => (
            <View key={row.label}>
              <StyledText variant="caption">{row.label}</StyledText>
              <StyledText>{row.value}</StyledText>
            </View>
          ))}
          {item.missingFields.length ? (
            <StyledText accessibilityRole="alert">
              {translate('tracking.review.missingFields')}:{' '}
              {item.missingFields.map(trackingFieldLabel).join(' · ')}
            </StyledText>
          ) : null}
        </View>
      </SurfaceCard>
      {resolutionError ? (
        <StateView
          state="error"
          title={translate('tracking.review.resolveError')}
        />
      ) : null}
      <ActionButton
        label={translate('tracking.action.confirm')}
        loading={resolving}
        onPress={() => void resolve('confirm')}
      />
      <ActionButton
        label={translate('tracking.action.ignore')}
        disabled={resolving}
        onPress={() => void resolve('ignore')}
        variant="secondary"
      />
      <ActionButton
        label={translate('tracking.action.reportWrong')}
        disabled={resolving}
        onPress={() => void resolve('report_wrong')}
        variant="destructive"
      />
    </ScrollView>
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 }
});
