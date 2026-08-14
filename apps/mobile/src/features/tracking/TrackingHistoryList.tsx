import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { translate } from '@/localization/i18n';
import { automaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { trackingReasonSummary } from './tracking-display';
import {
  invalidateTrackingScopes,
  useTrackingHistory
} from './useAutomaticTracking';

export function TrackingHistoryList() {
  const client = useQueryClient();
  const query = useTrackingHistory();
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
    <View style={styles.stack}>
      <ActionButton
        label={translate('tracking.action.clearHistory')}
        onPress={async () => {
          const result = await automaticTrackingService.clearHistory();
          await invalidateTrackingScopes(client, result.affectedScopes);
        }}
        variant="destructive"
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <StateView
            state="empty"
            title={translate('tracking.history.empty')}
          />
        }
        renderItem={({ item }) => (
          <SurfaceCard>
            <StyledText variant="subtitle">
              {translate(`tracking.history.${item.action}` as never)}
            </StyledText>
            <StyledText>{trackingReasonSummary(item.reasonCodes)}</StyledText>
          </SurfaceCard>
        )}
        contentContainerStyle={styles.stack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 }
});
