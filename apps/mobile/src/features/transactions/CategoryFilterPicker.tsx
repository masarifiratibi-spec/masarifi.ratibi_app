import React, { useMemo, useState } from 'react';
import { FlatList, SectionList, StyleSheet } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { StateView } from '@/design-system/components/feedback/StateView';
import { FormField } from '@/design-system/components/forms/FormField';
import type { Category } from '@/domain/core-finance';
import { CategoryRow } from '@/features/categories/CategoryRow';
import {
  matchesCategorySearch,
  projectCategory
} from '@/features/categories/category-presentation';
import { useCategories } from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';

export function CategoryFilterPicker({
  selectedId,
  selectedIds = [],
  excludedIds = [],
  groupFavorites = false,
  onSelect
}: {
  selectedId?: string;
  selectedIds?: string[];
  excludedIds?: string[];
  groupFavorites?: boolean;
  onSelect?: (category: Category) => void;
}) {
  const categories = useCategories(true);
  const [search, setSearch] = useState('');
  const locale = currentLocale();
  const byId = useMemo(
    () =>
      new Map<string, Category>(
        ((categories.data ?? []) as Category[]).map((item) => [item.id, item])
      ),
    [categories.data]
  );
  const filtered = useMemo(
    () =>
      ((categories.data ?? []) as Category[])
        .filter(
          (category) =>
            category.status === 'active' && !excludedIds.includes(category.id)
        )
        .map((category) =>
          projectCategory(
            category,
            locale,
            category.parentId ? byId.get(category.parentId) : undefined
          )
        )
        .filter((category) => matchesCategorySearch(category, search))
        .sort(
          (a, b) =>
            Number(b.category.isFavorite) - Number(a.category.isFavorite) ||
            a.label.localeCompare(b.label)
        ),
    [byId, categories.data, excludedIds, locale, search]
  );
  if (categories.isError) {
    return (
      <StateView
        state="error"
        title={translate('coreFinance.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => void categories.refetch()}
      />
    );
  }
  const header = (
    <FormField
      label={translate('coreFinance.categories.search')}
      value={search}
      onChangeText={setSearch}
      variant="search"
    />
  );
  const empty = (
    <StateView
      state={categories.isLoading ? 'loading' : 'empty'}
      title={
        categories.isLoading
          ? translate('coreFinance.state.loading')
          : translate('coreFinance.categories.noSearchResults')
      }
    />
  );
  const row = (
    item: (typeof filtered)[number],
    index: number,
    count: number
  ) => (
    <CategoryRow
      groupedPosition={
        count === 1
          ? 'only'
          : index === 0
            ? 'first'
            : index === count - 1
              ? 'last'
              : 'middle'
      }
      presentation={item}
      selected={
        selectedId === item.category.id ||
        selectedIds.includes(item.category.id)
      }
      onPress={() => onSelect?.(item.category)}
    />
  );

  if (groupFavorites) {
    const sections = [
      {
        key: 'favorites',
        title: translate('coreFinance.categories.mostUsed'),
        data: filtered.filter((item) => item.category.isFavorite)
      },
      {
        key: 'other',
        title: translate('coreFinance.categories.other'),
        data: filtered.filter((item) => !item.category.isFavorite)
      }
    ].filter((section) => section.data.length > 0);

    return (
      <SectionList
        contentContainerStyle={styles.stack}
        sections={sections}
        keyExtractor={(item) => item.category.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderSectionHeader={({ section }) => (
          <StyledText style={styles.sectionHeader} variant="subtitle">
            {section.title}
          </StyledText>
        )}
        renderItem={({ item, index, section }) =>
          row(item, index, section.data.length)
        }
      />
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.stack}
      data={filtered}
      keyExtractor={(item) => item.category.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item, index }) => row(item, index, filtered.length)}
    />
  );
}

const styles = StyleSheet.create({
  stack: { padding: 16 },
  sectionHeader: { paddingBottom: 8, paddingTop: 16 }
});
