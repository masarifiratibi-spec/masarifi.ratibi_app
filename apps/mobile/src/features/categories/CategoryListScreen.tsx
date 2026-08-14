import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { StyledText } from '@/components/StyledText';
import type { Category } from '@/domain/core-finance';
import { useCategories } from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function CategoryListScreen() {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const query = useCategories(true);
  const items = useMemo(
    () =>
      (query.data ?? [])
        .filter((item: Category) =>
          `${item.labelAr} ${item.labelEn}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase())
        )
        .sort(
          (a: Category, b: Category) =>
            Number(b.isFavorite) - Number(a.isFavorite)
        ),
    [query.data, search]
  );
  if (query.isLoading)
    return (
      <StateView
        state="loading"
        title={translate('coreFinance.state.loading')}
      />
    );
  if (query.isError)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => void query.refetch()}
      />
    );
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            accessibilityLabel={translate('coreFinance.categories.search')}
            placeholder={translate('coreFinance.categories.search')}
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={[
              styles.search,
              {
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary
              }
            ]}
          />
          <ActionButton
            label={translate('coreFinance.categories.add')}
            onPress={() => router.push('/categories/new')}
          />
        </View>
      }
      ListEmptyComponent={
        <StateView
          state="empty"
          title={translate('coreFinance.categories.empty')}
        />
      }
      renderItem={({ item }) => (
        <SurfaceCard>
          <View style={styles.row}>
            <StyledText variant="subtitle">
              {currentLocale() === 'ar' ? item.labelAr : item.labelEn}
            </StyledText>
            <ActionButton
              label={
                item.status === 'active'
                  ? translate('coreFinance.categories.open')
                  : translate('coreFinance.categories.archived')
              }
              variant="secondary"
              onPress={() => router.push(`/categories/${item.id}`)}
            />
          </View>
        </SurfaceCard>
      )}
    />
  );
}
const styles = StyleSheet.create({
  content: { gap: 10, padding: 16, paddingBottom: 40 },
  header: { gap: 10 },
  search: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12
  },
  row: { gap: 8 }
});
