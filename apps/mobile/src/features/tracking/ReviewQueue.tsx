import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { translate } from '@/localization/i18n';
import { trackingReasonSummary } from './tracking-display';
import { useReviewItems } from './useAutomaticTracking';

export function ReviewQueue() {
  const query = useReviewItems();
  if (query.isLoading)
    return (
      <StateView state="loading" title={translate('tracking.state.loading')} />
    );
  if (query.isError)
    return (
      <StateView
        state="error"
        title={translate('tracking.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => void query.refetch()}
      />
    );
  const items = query.data?.items ?? [];
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <StyledText variant="title">
          {translate('tracking.review.title')}
        </StyledText>
      }
      ListEmptyComponent={
        <StateView state="empty" title={translate('tracking.review.empty')} />
      }
      renderItem={({ item }) => (
        <SurfaceCard>
          <StyledText variant="subtitle">
            {trackingReasonSummary(item.reasonCodes)}
          </StyledText>
          <ActionButton
            label={translate('tracking.action.open')}
            onPress={() => router.push(`/tracking/review/${item.id}`)}
          />
        </SurfaceCard>
      )}
      contentContainerStyle={styles.stack}
    />
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 }
});
