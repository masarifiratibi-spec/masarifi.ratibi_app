import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useAppShellStore } from '@/state/app-shell';
import { TrackingError } from '@/services/contracts/automatic-tracking-service';

import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { translate } from '@/localization/i18n';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { trackingReasonSummary } from './tracking-display';
import { TrackingDemoNotice } from './components/TrackingDemoNotice';
import {
  useTrackingMutation,
  useTrackingHistory
} from './useAutomaticTracking';

export function TrackingHistoryList() {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  const clear = useTrackingMutation<{ ownerId: string | null }, number>(
    (intent) => {
      if (
        (useAppShellStore.getState().session?.userId ?? null) !== intent.ownerId
      )
        throw new TrackingError('permission_required');
      return automaticTrackingService.clearHistory();
    }
  );
  const query = useTrackingHistory();
  if (query.isLoading && !hasReadableSnapshot(query))
    return (
      <StateView state="loading" title={translate('tracking.state.loading')} />
    );
  if (!hasReadableSnapshot(query))
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
      <StyledText variant="title">
        {translate('tracking.action.history')}
      </StyledText>
      <TrackingDemoNotice />
      <FinancialRefreshStatus query={query} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <StateView
            state="empty"
            title={translate('tracking.history.empty')}
          />
        }
        renderItem={({ item }) => {
          const action = translate(`tracking.history.${item.action}` as never);
          return (
            <GroupedList label={action}>
              <NavigationRow
                label={action}
                description={trackingReasonSummary(item.reasonCodes)}
              />
            </GroupedList>
          );
        }}
        contentContainerStyle={styles.stack}
      />
      {clear.isError ? (
        <StateView state="error" title={translate('tracking.state.error')} />
      ) : null}
      <ActionButton
        label={translate('tracking.action.clearHistory')}
        onPress={() => {
          if (query.isError || query.isFetching || clear.isPending) return;
          clear.mutate({ ownerId });
        }}
        loading={clear.isPending}
        disabled={query.isError || query.isFetching || clear.isPending}
        variant="destructive"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 }
});
