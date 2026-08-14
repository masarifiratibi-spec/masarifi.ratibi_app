import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FormField } from '@/design-system/components/forms/FormField';
import { RadioCard } from '@/design-system/components/forms/SelectionControls';
import type { Category } from '@/domain/core-finance';
import { useCategories } from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';

export function CategoryPicker({
  selectedId,
  onSelect
}: {
  selectedId?: string;
  onSelect?: (category: Category) => void;
}) {
  const categories = useCategories(true);
  const [search, setSearch] = useState('');
  const locale = currentLocale();
  const filtered = useMemo<Category[]>(
    () =>
      (categories.data ?? [])
        .filter(
          (category: Category) =>
            category.status === 'active' &&
            `${category.labelAr} ${category.labelEn}`
              .toLocaleLowerCase('en')
              .includes(search.trim().toLocaleLowerCase('en'))
        )
        .sort(
          (a: Category, b: Category) =>
            Number(b.isFavorite) - Number(a.isFavorite) ||
            (locale === 'ar' ? a.labelAr : a.labelEn).localeCompare(
              locale === 'ar' ? b.labelAr : b.labelEn
            )
        ),
    [categories.data, locale, search]
  );
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <FormField
        label={translate('coreFinance.categories.search')}
        value={search}
        onChangeText={setSearch}
        variant="search"
      />
      {filtered.map((category: Category) => (
        <RadioCard
          key={category.id}
          label={locale === 'ar' ? category.labelAr : category.labelEn}
          selected={selectedId === category.id}
          onPress={() => onSelect?.(category)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ stack: { gap: 10, padding: 16 } });
