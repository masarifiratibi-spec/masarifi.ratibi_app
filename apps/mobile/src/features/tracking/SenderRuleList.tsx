import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { StyledText } from '@/components/StyledText';
import { FormField } from '@/design-system/components/forms/FormField';
import { StateView } from '@/design-system/components/feedback/StateView';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { translate } from '@/localization/i18n';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import {
  invalidateTrackingScopes,
  useSenderRules
} from './useAutomaticTracking';
import { TrackingDemoNotice } from './components/TrackingDemoNotice';

export function SenderRuleList() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const query = useSenderRules(search);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const items = hasReadableSnapshot(query) ? (query.data ?? []) : [];
  if (!hasReadableSnapshot(query))
    return (
      <StateView
        state={query.isLoading ? 'loading' : 'error'}
        title={translate(
          query.isLoading ? 'tracking.state.loading' : 'tracking.state.error'
        )}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => void query.refetch()}
      />
    );
  return (
    <View style={styles.stack}>
      <StyledText variant="title">
        {translate('tracking.senders.title')}
      </StyledText>
      <TrackingDemoNotice />
      <FinancialRefreshStatus query={query} />
      {saveFailed ? (
        <StyledText accessibilityRole="alert">
          {translate('tracking.state.error')}
        </StyledText>
      ) : null}
      <FormField
        label={translate('tracking.senders.search')}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <StateView
            state="empty"
            title={translate('tracking.senders.empty')}
          />
        }
        renderItem={({ item }) => {
          const state = translate(
            item.enabled
              ? 'tracking.senders.enabled'
              : 'tracking.senders.disabled'
          );
          const action = translate(
            item.enabled ? 'tracking.action.disable' : 'tracking.action.enable'
          );
          return (
            <GroupedList label={item.displayLabel}>
              <NavigationRow
                label={item.displayLabel}
                description={state}
                status={action}
                disabled={saving || query.isError || query.isFetching}
                onPress={async () => {
                  if (saving || query.isError || query.isFetching) return;
                  setSaving(true);
                  setSaveFailed(false);
                  try {
                    const result =
                      await automaticTrackingService.saveSenderRule({
                        id: item.id,
                        sender: item.normalizedSender,
                        displayLabel: item.displayLabel,
                        institutionKey: item.institutionKey,
                        origin: item.origin,
                        enabled: !item.enabled,
                        trusted: item.trusted
                      });
                    await invalidateTrackingScopes(
                      client,
                      result.affectedScopes
                    );
                  } catch {
                    setSaveFailed(true);
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            </GroupedList>
          );
        }}
        contentContainerStyle={styles.stack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 }
});
