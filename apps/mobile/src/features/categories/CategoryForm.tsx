import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import {
  RadioCard,
  SwitchRow
} from '@/design-system/components/forms/SelectionControls';
import type { Category } from '@/domain/core-finance';
import {
  invalidateCoreFinanceScopes,
  useCategories
} from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

export function CategoryForm({ category }: { category?: Category }) {
  const client = useQueryClient();
  const categories = useCategories();
  const locale = currentLocale();
  const [labelAr, setLabelAr] = useState(category?.labelAr ?? '');
  const [labelEn, setLabelEn] = useState(category?.labelEn ?? '');
  const [parentId, setParentId] = useState(category?.parentId ?? null);
  const [favorite, setFavorite] = useState(category?.isFavorite ?? false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLabelAr(category.labelAr);
    setLabelEn(category.labelEn);
    setParentId(category.parentId);
    setFavorite(category.isFavorite);
    setError(undefined);
  }, [category]);

  const save = async () => {
    if (!labelAr.trim() || !labelEn.trim()) {
      setError(translate('coreFinance.validation.required'));
      return;
    }
    const input = {
      labelAr,
      labelEn,
      parentId,
      iconKey: category?.iconKey ?? null,
      colorKey: category?.colorKey ?? null,
      isFavorite: favorite
    };
    setSaving(true);
    setError(undefined);
    try {
      const result = category
        ? await coreFinanceService.updateCategory(category.id, input)
        : await coreFinanceService.createCategory(input);
      await invalidateCoreFinanceScopes(client, result.affectedScopes);
      router.replace('/categories');
    } catch {
      setError(translate('coreFinance.state.error'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
    >
      <FormField
        label={translate('coreFinance.categories.labelAr')}
        value={labelAr}
        onChangeText={setLabelAr}
        errorText={error}
        autoFocus
      />
      <FormField
        label={translate('coreFinance.categories.labelEn')}
        value={labelEn}
        onChangeText={setLabelEn}
      />
      <RadioCard
        label={translate('coreFinance.categories.noParent')}
        selected={!parentId}
        onPress={() => setParentId(null)}
      />
      {categories.data
        ?.filter(
          (item: Category) =>
            item.id !== category?.id && item.status === 'active'
        )
        .slice(0, 12)
        .map((item: Category) => (
          <RadioCard
            key={item.id}
            label={locale === 'ar' ? item.labelAr : item.labelEn}
            selected={parentId === item.id}
            onPress={() => setParentId(item.id)}
          />
        ))}
      <SwitchRow
        label={translate('coreFinance.categories.favorite')}
        value={favorite}
        onValueChange={setFavorite}
      />
      <ActionButton
        label={translate('coreFinance.categories.save')}
        loading={saving}
        onPress={() => void save()}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 10, padding: 16, paddingBottom: 40 }
});
