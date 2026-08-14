import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StateView } from '@/design-system/components/feedback/StateView';
import { CategoryDetailScreen } from '@/features/categories/CategoryDetailScreen';
import { CategoryForm } from '@/features/categories/CategoryForm';
import { useCategories } from '@/features/core-finance/core-finance-queries';
import type { Category } from '@/domain/core-finance';
import { translate } from '@/localization/i18n';
export default function CategoryDetailRoute() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const query = useCategories(true);
  const category = query.data?.find((item: Category) => item.id === id);
  if (!edit) return <CategoryDetailScreen id={id ?? ''} />;
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
  return <CategoryForm category={category} />;
}
