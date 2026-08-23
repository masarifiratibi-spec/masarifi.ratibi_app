import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { StyledText } from '@/components/StyledText';
import { ChipSelector } from '@/design-system/components/forms/ChipControls';
import { FormField } from '@/design-system/components/forms/FormField';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import {
  syncStatuses,
  transactionSources,
  transactionTypes,
  parseAmountToMinor,
  type Account,
  type Category
} from '@/domain/core-finance';
import { minorToMajorAmountText } from '@/domain/currencies';
import {
  useAccounts,
  useCategories
} from '@/features/core-finance/core-finance-queries';
import { DateRangeSheet } from '@/features/filters/DateRangeSheet';
import {
  formatPeriodLabel,
  periodFromRange
} from '@/features/filters/date-period';
import { currentLocale } from '@/localization/i18n';
import { AccountPicker } from './AccountPicker';
import { CategoryFilterPicker } from './CategoryFilterPicker';
import { useTheme } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';

const recordStatuses = [
  'posted',
  'pending',
  'failed',
  'reversed',
  'refunded',
  'deleted'
] as const;
const sortValues = ['newest', 'oldest', 'amount_high', 'amount_low'] as const;

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function TransactionFilters({
  onApplied,
  onCancelled
}: {
  onApplied?: () => void;
  onCancelled?: () => void;
} = {}) {
  const theme = useTheme();
  const baseCurrencyCode = usePreferenceStore(
    (state) => state.baseCurrencyCode
  );
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const monthStartDay = usePreferenceStore((state) => state.monthStartDay);
  const draft = useCoreFinanceViewState((state) => state.draftFilters);
  const edit = useCoreFinanceViewState((state) => state.editFilters);
  const apply = useCoreFinanceViewState((state) => state.applyFilters);
  const begin = useCoreFinanceViewState((state) => state.beginFilterSession);
  const cancel = useCoreFinanceViewState((state) => state.cancelFilterSession);
  const clear = useCoreFinanceViewState((state) => state.resetDraftFilters);
  const [error, setError] = useState<string>();
  const [periodOpen, setPeriodOpen] = useState(false);
  const [picker, setPicker] = useState<'accounts' | 'categories' | null>(null);
  const accounts = useAccounts(true, draft.accountIds.length > 0);
  const categories = useCategories(true, draft.categoryIds.length > 0);
  const locale = currentLocale();
  const period = periodFromRange(
    draft.periodStart,
    draft.periodEnd,
    Date.now(),
    { timeZone, monthStartDay }
  );
  const amountCurrencyCode = draft.amountCurrencyCode ?? baseCurrencyCode;
  useEffect(begin, [begin]);
  const accountValue = draft.accountIds
    .map(
      (id) =>
        accounts.data?.find((account: Account) => account.id === id)?.name ?? id
    )
    .join(', ');
  const categoryValue = draft.categoryIds
    .map((id) => {
      const category = categories.data?.find(
        (item: Category) => item.id === id
      );
      return category
        ? locale === 'ar'
          ? category.labelAr
          : category.labelEn
        : id;
    })
    .join(', ');
  return (
    <View
      style={[
        styles.screen,
        Boolean(onApplied || onCancelled) && styles.sheetScreen
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.stack}
        keyboardShouldPersistTaps="handled"
      >
        <FilterSection title={translate('coreFinance.filters.period')}>
          <PickerField
            label={translate('coreFinance.filters.period')}
            value={formatPeriodLabel(period, locale, timeZone)}
            onPress={() => setPeriodOpen(true)}
          />
          <DateRangeSheet
            visible={periodOpen}
            period={period}
            onApply={(next) =>
              edit({
                periodStart: next.periodStart,
                periodEnd: next.periodEnd
              })
            }
            onDismiss={() => setPeriodOpen(false)}
          />
        </FilterSection>
        <FilterSection
          title={translate('coreFinance.filters.accountsAndCategories')}
        >
          <PickerField
            label={translate('coreFinance.filters.accounts')}
            value={accountValue || undefined}
            placeholder={translate('coreFinance.filters.any')}
            onPress={() => setPicker('accounts')}
          />
          <PickerField
            label={translate('coreFinance.filters.categories')}
            value={categoryValue || undefined}
            placeholder={translate('coreFinance.filters.any')}
            onPress={() => setPicker('categories')}
          />
        </FilterSection>
        {picker === 'accounts' ? (
          <AppSheet
            title={translate('coreFinance.filters.accounts')}
            visible
            onDismiss={() => setPicker(null)}
          >
            <AccountPicker
              selectedIds={draft.accountIds}
              onSelect={(account) =>
                edit({ accountIds: toggle(draft.accountIds, account.id) })
              }
            />
          </AppSheet>
        ) : null}
        {picker === 'categories' ? (
          <AppSheet
            title={translate('coreFinance.filters.categories')}
            visible
            onDismiss={() => setPicker(null)}
          >
            <CategoryFilterPicker
              selectedIds={draft.categoryIds}
              onSelect={(category) =>
                edit({ categoryIds: toggle(draft.categoryIds, category.id) })
              }
            />
          </AppSheet>
        ) : null}
        <FilterSection title={translate('coreFinance.filters.typesAndSources')}>
          <FilterChips
            title={translate('coreFinance.filters.types')}
            values={[...transactionTypes]}
            selected={draft.types}
            label={(value) => translate(`coreFinance.type.${value}` as never)}
            onToggle={(value) => edit({ types: toggle(draft.types, value) })}
          />
          <FilterChips
            title={translate('coreFinance.filters.sources')}
            values={[...transactionSources]}
            selected={draft.sources}
            label={(value) => translate(`coreFinance.source.${value}` as never)}
            onToggle={(value) =>
              edit({ sources: toggle(draft.sources, value) })
            }
          />
        </FilterSection>
        <FilterSection title={translate('coreFinance.filters.statusAndReview')}>
          <FilterChips
            title={translate('coreFinance.filters.statuses')}
            values={[...recordStatuses]}
            selected={draft.statuses}
            label={(value) => translate(`coreFinance.status.${value}` as never)}
            onToggle={(value) =>
              edit({ statuses: toggle(draft.statuses, value) })
            }
          />
          <FilterChips
            title={translate('coreFinance.filters.syncStatuses')}
            values={[...syncStatuses]}
            selected={draft.syncStatuses}
            label={(value) => translate(`coreFinance.sync.${value}` as never)}
            onToggle={(value) =>
              edit({ syncStatuses: toggle(draft.syncStatuses, value) })
            }
          />
          <FilterChips
            title={translate('coreFinance.filters.review')}
            values={[null, true, false]}
            selected={[draft.reviewRequired]}
            label={(value) =>
              translate(
                value === null
                  ? 'coreFinance.filters.reviewAll'
                  : value
                    ? 'coreFinance.filters.reviewRequired'
                    : 'coreFinance.filters.reviewNotRequired'
              )
            }
            onToggle={(reviewRequired) => edit({ reviewRequired })}
          />
        </FilterSection>
        <FilterSection title={translate('coreFinance.filters.amountAndSort')}>
          <FilterChips
            title={translate('coreFinance.filters.sort')}
            values={[...sortValues]}
            selected={[draft.sort]}
            label={(value) =>
              translate(`coreFinance.filters.sort.${value}` as never)
            }
            onToggle={(sort) => edit({ sort })}
          />
          <FormField
            label={translate('coreFinance.filters.minimum')}
            variant="amount"
            value={
              draft.minMinor === null
                ? ''
                : minorToMajorAmountText(draft.minMinor, amountCurrencyCode)
            }
            onChangeText={(value) => {
              const minMinor = value
                ? parseAmountToMinor(value, amountCurrencyCode)
                : null;
              edit({
                minMinor,
                amountCurrencyCode:
                  minMinor !== null || draft.maxMinor !== null
                    ? amountCurrencyCode
                    : null
              });
            }}
          />
          <FormField
            label={translate('coreFinance.filters.maximum')}
            variant="amount"
            value={
              draft.maxMinor === null
                ? ''
                : minorToMajorAmountText(draft.maxMinor, amountCurrencyCode)
            }
            onChangeText={(value) => {
              const maxMinor = value
                ? parseAmountToMinor(value, amountCurrencyCode)
                : null;
              edit({
                maxMinor,
                amountCurrencyCode:
                  maxMinor !== null || draft.minMinor !== null
                    ? amountCurrencyCode
                    : null
              });
            }}
          />
        </FilterSection>
        {error ? <StyledText variant="caption">{error}</StyledText> : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }
        ]}
      >
        <ActionButton
          label={translate('coreFinance.filters.apply')}
          onPress={() => {
            if (
              draft.minMinor !== null &&
              draft.maxMinor !== null &&
              draft.minMinor > draft.maxMinor
            ) {
              setError(translate('coreFinance.filters.rangeInvalid'));
              return;
            }
            apply();
            if (onApplied) onApplied();
            else router.back();
          }}
        />
        <ActionButton
          label={translate('coreFinance.filters.clear')}
          variant="quiet"
          onPress={() => {
            clear();
            setError(undefined);
          }}
        />
        <ActionButton
          label={translate('coreFinance.cancel')}
          variant="quiet"
          onPress={() => {
            cancel();
            if (onCancelled) onCancelled();
            else router.back();
          }}
        />
      </View>
    </View>
  );
}

function FilterSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      testID="advanced-filter-section"
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border
        }
      ]}
    >
      <StyledText variant="subtitle">{title}</StyledText>
      {children}
    </View>
  );
}

function FilterChips<T extends string | boolean | null>({
  title,
  values,
  selected,
  label,
  onToggle
}: {
  title: string;
  values: T[];
  selected: T[];
  label: (value: T) => string;
  onToggle: (value: T) => void;
}) {
  const labels = values.map(label);
  return (
    <>
      <StyledText variant="subtitle">{title}</StyledText>
      <ChipSelector
        options={labels}
        selected={selected.map(label)}
        onToggle={(selectedLabel) => {
          const index = labels.indexOf(selectedLabel);
          if (index >= 0) onToggle(values[index]);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  sheetScreen: { flexShrink: 1, height: 560 },
  stack: { gap: 12, padding: 16, paddingBottom: 24 },
  section: { borderRadius: 12, borderWidth: 1, gap: 12, padding: 16 },
  footer: { borderTopWidth: 1, gap: 8, padding: 16 }
});
