import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import {
  NavigationRow,
  GroupedList
} from '@/design-system/components/navigation/GroupedList';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate, currentLocale } from '@/localization/i18n';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import {
  useIosPendingReviewItems,
  useDuplicateCandidates
} from './useAutomaticTracking';
import { trackingReasonSummary } from './tracking-display';

export function IosShortcutReviewQueue() {
  const reviews = useIosPendingReviewItems();
  const duplicates = useDuplicateCandidates();
  const pending = (reviews.data?.items ?? []).filter(
    (item) => item.status === 'pending'
  );
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <StyledText variant="title">
        {translate('tracking.review.title')}
      </StyledText>
      <StyledText>{translate('tracking.shortcut.reviewScope')}</StyledText>
      {reviews.isLoading ? (
        <StyledText>{translate('tracking.state.loading')}</StyledText>
      ) : null}
      {reviews.isError || duplicates.isError ? (
        <ActionButton
          label={translate('coreFinance.action.retry')}
          onPress={() => {
            void reviews.refetch();
            void duplicates.refetch();
          }}
        />
      ) : null}
      {hasReadableSnapshot(reviews) && pending.length === 0 ? (
        <StyledText>{translate('tracking.review.empty')}</StyledText>
      ) : null}
      {hasReadableSnapshot(reviews)
        ? pending.map((item) => {
            const duplicate = duplicates.data?.find(
              (row) => row.detectedEventId === item.detectedEventId
            );
            const amount = item.proposedValues.amountMinor;
            const currency =
              item.proposedValues.currency ?? item.proposedValues.currencyCode;
            return (
              <GroupedList
                key={item.id}
                label={translate('tracking.review.detail')}
              >
                <NavigationRow
                  label={trackingReasonSummary(item.reasonCodes)}
                  value={
                    typeof amount === 'number' && typeof currency === 'string'
                      ? formatMinorAmount(amount, currency, currentLocale())
                      : undefined
                  }
                  disabled={
                    reviews.isError ||
                    duplicates.isError ||
                    duplicates.isLoading
                  }
                  onPress={() =>
                    router.push(
                      duplicate
                        ? `/capture/duplicates/${duplicate.id}`
                        : `/capture/review/${item.id}`
                    )
                  }
                />
              </GroupedList>
            );
          })
        : null}
      <ActionButton
        label={translate('tracking.shortcut.title')}
        onPress={() => router.replace('/capture/ios')}
        variant="secondary"
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({ content: { padding: 16, gap: 12 } });
