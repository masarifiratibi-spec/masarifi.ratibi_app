import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import type { SupportFeedback } from '@/domain/support';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { StateView } from '@/design-system/components/feedback/StateView';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { translateDynamic as t } from '@/localization/i18n';
import { isAuthoritativeReadDenial } from '@/services/read-snapshot';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { formatDateTime } from '@/utils/format-financial-value';
import { useSupportFeedback } from './support-queries';

export function FeedbackHistoryScreen() {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const owner = useAppShellStore((state) => state.session?.userId ?? null);
  const query = useSupportFeedback();
  const denied = !owner || isAuthoritativeReadDenial(query.error);
  const byId = new Map<string, SupportFeedback>();
  if (!denied)
    for (const item of query.data?.pages.flatMap((page) => page.items) ?? []) {
      const prior = byId.get(item.id);
      if (!prior || item.version > prior.version) byId.set(item.id, item);
    }
  const items = [...byId.values()];
  const state =
    denied || (query.isError && !items.length)
      ? 'error'
      : query.isPending
        ? 'loading'
        : 'empty';
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaces.page }}>
      <AppBar
        title={t('support.feedback.history')}
        onBack={() => router.back()}
        direction={direction}
      />
      <View style={styles.stack}>
        <ActionButton
          label="support.feedback.refresh"
          variant="secondary"
          disabled={query.isFetching || !owner}
          onPress={() => {
            void query.refetch();
          }}
        />
        <FinancialRefreshStatus query={query} />
      </View>
      {!items.length ? (
        <View style={styles.stack}>
          <StateView state={state} title={t(`support.feedback.${state}`)} />
        </View>
      ) : (
        <FlatList
          data={items}
          contentContainerStyle={styles.stack}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SurfaceCard style={styles.card}>
              <StyledText variant="subtitle">{item.subject}</StyledText>
              <StyledText>{item.body}</StyledText>
              <StyledText>
                {t(`support.feedback.status.${item.status}`)}
              </StyledText>
              <StyledText variant="caption">
                {formatDateTime(item.createdAt, locale)}
              </StyledText>
            </SurfaceCard>
          )}
          ListFooterComponent={
            query.hasNextPage ? (
              <ActionButton
                label="support.feedback.loadMore"
                variant="secondary"
                disabled={query.isFetching}
                onPress={() => {
                  void query.fetchNextPage();
                }}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 },
  card: { gap: 8 }
});
