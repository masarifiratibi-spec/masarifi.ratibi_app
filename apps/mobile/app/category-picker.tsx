import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { StateView } from '@/design-system/components/feedback/StateView';
import { CategorySelectionScreen } from '@/features/categories/CategorySelectionScreen';
import {
  cancelCategorySelection,
  completeCategorySelection,
  getCategorySelectionSession
} from '@/features/categories/category-selection-session';
import { translate } from '@/localization/i18n';

export default function CategoryPickerRoute() {
  const { requestId = '' } = useLocalSearchParams<{ requestId?: string }>();
  const session = getCategorySelectionSession(requestId);
  const back = () => {
    cancelCategorySelection(requestId);
    router.back();
  };

  if (!session) {
    return (
      <StateView
        actionLabel={translate('appShell.navigation.back')}
        onAction={() => router.back()}
        state="error"
        title={translate('coreFinance.state.error')}
      />
    );
  }

  return (
    <CategorySelectionScreen
      allowClear={session.allowClear}
      excludedIds={session.excludedIds}
      onBack={back}
      onSelect={(categoryId) => {
        if (completeCategorySelection(requestId, categoryId)) router.back();
      }}
      selectedId={session.selectedId}
    />
  );
}
