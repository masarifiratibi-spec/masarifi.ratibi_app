import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import type { Category } from '@/domain/core-finance';
import {
  invalidateCoreFinanceScopes,
  useCategories
} from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

export function CategoryDetailScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const query = useCategories(true);
  const locale = currentLocale();
  const category = query.data?.find((item: Category) => item.id === id);
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
  if (!category)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.categories.missing')}
        actionLabel={translate('appShell.navigation.back')}
        onAction={() => router.back()}
      />
    );
  const target = query.data?.find(
    (item: Category) => item.id !== id && item.status === 'active'
  );
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {locale === 'ar' ? category.labelAr : category.labelEn}
      </StyledText>
      <ActionButton
        label={translate('coreFinance.categories.edit')}
        variant="secondary"
        onPress={() => router.push(`/categories/${id}?edit=1`)}
      />
      <ActionButton
        label={
          category.status === 'archived'
            ? translate('coreFinance.categories.restore')
            : translate('coreFinance.categories.archive')
        }
        variant={category.status === 'archived' ? 'secondary' : 'destructive'}
        onPress={async () => {
          const result = await coreFinanceService.setCategoryStatus(
            id,
            category.status === 'archived' ? 'active' : 'archived'
          );
          await invalidateCoreFinanceScopes(client, result.affectedScopes);
          router.replace('/categories');
        }}
      />
      {category.status === 'active' && target ? (
        <ActionButton
          label={`${translate('coreFinance.categories.merge')} - ${
            locale === 'ar' ? target.labelAr : target.labelEn
          }`}
          variant="secondary"
          onPress={async () => {
            const result = await coreFinanceService.mergeCategory(
              id,
              target.id
            );
            await invalidateCoreFinanceScopes(client, result.affectedScopes);
            router.replace('/categories');
          }}
        />
      ) : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({ stack: { gap: 12, padding: 16 } });
