import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { StateView } from '@/design-system/components/feedback/StateView';
import { FormField } from '@/design-system/components/forms/FormField';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { CategoryIcon } from '@/design-system/components/financial/FinancialPrimitives';
import { DesignIcon, type DesignIconName } from '@/design-system/icons';
import {
  minTouchTarget,
  radius,
  spacing,
  typography
} from '@/design-system/tokens';
import {
  parseAmountToMinor,
  type Account,
  type Category,
  type Transaction,
  type TransactionType
} from '@/domain/core-finance';
import { minorToMajorAmountText } from '@/domain/currencies';
import {
  invalidateCoreFinanceScopes,
  useAccounts,
  useCategories
} from '@/features/core-finance/core-finance-queries';
import { categoryIconName } from '@/features/categories/category-presentation';
import { openCategorySelection } from '@/features/categories/category-selection-session';
import {
  currentLocale,
  translate,
  translateDynamic
} from '@/localization/i18n';
import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useTransactionDraftGuard } from './useTransactionDraftGuard';
import { AccountPicker } from './AccountPicker';
import { TransactionDateField } from './TransactionDateField';
import { TransactionActions } from './TransactionActions';
import { MANUAL_TRANSACTION_DRAFT_ID } from './manual-transaction-draft';

const editSupportedTypes: TransactionType[] = ['expense', 'income', 'transfer'];

export function TransactionForm({
  initialType = 'expense',
  initialAccountId = '',
  transaction
}: {
  initialType?: TransactionType;
  initialAccountId?: string;
  transaction?: Transaction;
}) {
  const accounts = useAccounts();
  const categories = useCategories();
  const client = useQueryClient();
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = currentLocale();
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? initialType
  );
  const [amount, setAmount] = useState(
    transaction
      ? minorToMajorAmountText(
          transaction.amountMinor,
          transaction.currencyCode
        )
      : ''
  );
  const [title, setTitle] = useState(transaction?.title ?? '');
  const [accountId, setAccountId] = useState(
    transaction?.accountId ?? initialAccountId
  );
  const [destinationAccountId, setDestination] = useState(
    transaction?.destinationAccountId ?? ''
  );
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '');
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [occurredAt, setOccurredAt] = useState(
    transaction?.occurredAt ?? Date.now()
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(transaction?.status === 'deleted');
  const [draftReady, setDraftReady] = useState(Boolean(transaction));
  const skipNextDraftReload = useRef(false);
  const [picker, setPicker] = useState<'account' | 'destination' | null>(null);
  const meaningful = Boolean(
    amount || title || accountId || destinationAccountId || categoryId || notes
  );
  const saveManualDraft = useCallback(
    () =>
      coreFinanceService.saveDraft({
        id: MANUAL_TRANSACTION_DRAFT_ID,
        transactionType: type,
        amountText: amount,
        accountId: accountId || null,
        destinationAccountId: destinationAccountId || null,
        categoryId: categoryId || null,
        merchant: title || null,
        notes: notes || null,
        occurredAt,
        status: 'editing',
        updatedAt: Date.now()
      }),
    [
      accountId,
      amount,
      categoryId,
      destinationAccountId,
      notes,
      occurredAt,
      title,
      type
    ]
  );
  const discard = useCallback(
    () => coreFinanceService.discardDraft(MANUAL_TRANSACTION_DRAFT_ID),
    []
  );
  const requestClose = useTransactionDraftGuard({ meaningful, discard });
  const sourceAccountId = accountId || accounts.data?.[0]?.id;
  const resolvedCategoryId = categoryId || categories.data?.[0]?.id || '';
  const selectedAccount = accounts.data?.find(
    (item: Account) => item.id === sourceAccountId
  );
  const selectedDestination = accounts.data?.find(
    (item: Account) => item.id === destinationAccountId
  );
  const selectedCategory = categories.data?.find(
    (item: Category) => item.id === resolvedCategoryId
  );
  const selectedCurrencyCode = transaction
    ? selectedAccount?.currencyCode ?? transaction.currencyCode
    : selectedAccount?.currencyCode ?? 'SAR';
  const editDirty = Boolean(
    transaction &&
    (type !== transaction.type ||
      parseAmountToMinor(amount, selectedCurrencyCode) !== transaction.amountMinor ||
      title !== transaction.title ||
      sourceAccountId !== transaction.accountId ||
      (destinationAccountId || null) !== transaction.destinationAccountId ||
      (type === 'transfer' ? null : resolvedCategoryId || null) !==
        transaction.categoryId ||
      notes !== (transaction.notes ?? '') ||
      occurredAt !== transaction.occurredAt)
  );
  const closeEdit = () => {
    if (!editDirty) {
      router.back();
      return;
    }
    Alert.alert(
      translate('coreFinance.transaction.leaveEditTitle'),
      translate('coreFinance.transaction.leaveEditMessage'),
      [
        { text: translate('coreFinance.cancel'), style: 'cancel' },
        {
          text: translate('coreFinance.transaction.discardChanges'),
          style: 'destructive',
          onPress: () => router.back()
        }
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      if (transaction) return;
      if (skipNextDraftReload.current) {
        skipNextDraftReload.current = false;
        return;
      }
      void coreFinanceService
        .loadDraft(MANUAL_TRANSACTION_DRAFT_ID)
        .then((draft) => {
          if (draft) {
            setType(draft.transactionType ?? initialType);
            setAmount(draft.amountText);
            setTitle(draft.merchant ?? '');
            setAccountId(draft.accountId ?? '');
            setDestination(draft.destinationAccountId ?? '');
            setCategoryId(draft.categoryId ?? '');
            setNotes(draft.notes ?? '');
            setOccurredAt(draft.occurredAt ?? Date.now());
          }
        })
        .catch(() => setError(translate('coreFinance.state.error')))
        .finally(() => setDraftReady(true));
    }, [initialType, transaction])
  );

  useEffect(() => {
    if (!draftReady || transaction || !meaningful) return;
    const timeout = setTimeout(() => {
      void saveManualDraft().catch(() =>
        setError(translate('coreFinance.state.error'))
      );
    }, 250);
    return () => clearTimeout(timeout);
  }, [draftReady, meaningful, saveManualDraft, transaction]);
  const save = async () => {
    if (saving || deleted) return;
    const resolvedAccount = accountId || accounts.data?.[0]?.id;
    const currencyCode = selectedCurrencyCode;
    const amountMinor = parseAmountToMinor(amount, currencyCode);
    const resolvedCategory = categoryId || categories.data?.[0]?.id || null;
    if (!amountMinor || !resolvedAccount || !title.trim()) {
      setError(translate('coreFinance.validation.required'));
      return;
    }
    setSaving(true);
    try {
      const input = {
        type,
        amountMinor,
        currencyCode,
        accountId: resolvedAccount,
        destinationAccountId:
          type === 'transfer' ? destinationAccountId || null : null,
        feeMinor: transaction?.feeMinor ?? 0,
        categoryId: type === 'transfer' ? null : resolvedCategory,
        title,
        merchant: transaction?.merchant ?? null,
        occurredAt,
        notes: notes.trim() || null,
        originalTransactionId: transaction?.originalTransactionId ?? null,
        obligationId: transaction?.obligationId ?? null
      };
      const mutation = transaction
        ? await coreFinanceService.updateTransaction(transaction.id, input)
        : await coreFinanceService.createTransaction(
            input,
            `manual-${Date.now()}`
          );
      await invalidateCoreFinanceScopes(client, mutation.affectedScopes);
      if (!transaction) await discard();
      if (transaction && router.canGoBack()) router.back();
      else router.replace('/(tabs)/transactions');
    } catch (caught) {
      setError(
        caught instanceof CoreFinanceError
          ? translate('coreFinance.validation.invalid')
          : translate('coreFinance.state.error')
      );
    } finally {
      setSaving(false);
    }
  };
  if (accounts.isLoading || categories.isLoading || !draftReady)
    return (
      <StateView
        state="loading"
        title={translate('coreFinance.state.loading')}
      />
    );
  if (accounts.isError || categories.isError)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => {
          void accounts.refetch();
          void categories.refetch();
        }}
      />
    );
  const pickerSheets = (
    <>
      {picker === 'account' || picker === 'destination' ? (
        <AppSheet
          title={translate(
            picker === 'account'
              ? 'coreFinance.transaction.account'
              : 'coreFinance.form.destination'
          )}
          visible
          onDismiss={() => setPicker(null)}
        >
          <AccountPicker
            excludedIds={
              picker === 'destination' && sourceAccountId
                ? [sourceAccountId]
                : []
            }
            selectedId={
              picker === 'account' ? sourceAccountId : destinationAccountId
            }
            onSelect={(account) => {
              if (picker === 'account') {
                setAccountId(account.id);
                if (destinationAccountId === account.id) setDestination('');
              } else if (account.id !== sourceAccountId) {
                setDestination(account.id);
              }
              setPicker(null);
            }}
          />
        </AppSheet>
      ) : null}
    </>
  );

  const categoryLabel = selectedCategory
    ? locale === 'ar'
      ? selectedCategory.labelAr
      : selectedCategory.labelEn
    : translate('coreFinance.transaction.category');
  const openPicker = async (target: 'account' | 'destination' | 'category') => {
    if (target === 'category') {
      if (!transaction) await saveManualDraft();
      openCategorySelection({
        selectedId: resolvedCategoryId,
        onSelect: (nextCategoryId) => {
          if (!nextCategoryId) return;
          if (!transaction) skipNextDraftReload.current = true;
          setCategoryId(nextCategoryId);
        }
      });
      return;
    }
    if (transaction) {
      setPicker(target);
      return;
    }
    await saveManualDraft();
    router.push(
      `/modals/account-picker?draft=manual&field=${
        target === 'account' ? 'accountId' : 'destinationAccountId'
      }`
    );
  };

  return (
    <View
      style={[styles.editRoot, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.editHeader,
          {
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.borders.subtle
          }
        ]}
      >
        <Pressable
          accessibilityLabel={translate('appShell.navigation.close')}
          accessibilityRole="button"
          onPress={transaction ? closeEdit : requestClose}
          style={styles.headerAction}
        >
          <DesignIcon
            name="close"
            label={translate('appShell.navigation.close')}
            color={theme.colors.content.link}
            decorative
          />
        </Pressable>
        <Text
          numberOfLines={2}
          style={[styles.editTitle, { color: theme.colors.content.primary }]}
        >
          {transaction
            ? translateDynamic('coreFinance.transaction.editNamed', {
                type: translate(`coreFinance.type.${type}` as never)
              })
            : translate('appShell.tabs.add')}
        </Text>
        <Pressable
          accessibilityLabel={translate('coreFinance.form.save')}
          accessibilityRole="button"
          accessibilityState={{
            busy: saving,
            disabled: saving || Boolean(transaction && deleted)
          }}
          disabled={saving || Boolean(transaction && deleted)}
          onPress={() => void save()}
          style={styles.headerAction}
        >
          <DesignIcon
            name="check"
            label={translate('coreFinance.form.save')}
            color={theme.colors.content.link}
            decorative
          />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.editStack}
        keyboardShouldPersistTaps="handled"
      >
        <View testID="transaction-edit-hero" style={styles.editHero}>
          <View
            testID="transaction-edit-type-selector"
            style={[
              styles.typeSelector,
              {
                direction: 'ltr',
                flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
              }
            ]}
          >
            {editSupportedTypes.map((item) => {
              const label = translate(`coreFinance.type.${item}` as never);
              const selected = item === type;
              return (
                <Pressable
                  key={item}
                  testID={`transaction-edit-type-${item}`}
                  accessibilityLabel={`${label} ${translate(
                    selected
                      ? 'designSystem.state.selected'
                      : deleted
                        ? 'designSystem.state.disabled'
                        : 'designSystem.state.available'
                  )}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: deleted }}
                  disabled={Boolean(transaction && deleted)}
                  onPress={() => {
                    setType(item);
                    if (item === 'transfer') setCategoryId('');
                    else setDestination('');
                  }}
                  style={({ pressed }) => [
                    styles.typeOption,
                    {
                      backgroundColor: selected
                        ? theme.colors.interactions.primary
                        : pressed
                          ? theme.colors.interactions.quietPressed
                          : theme.colors.surfaces.grouped,
                      opacity: transaction && deleted ? 0.56 : 1
                    }
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.typeOptionText,
                      {
                        color: selected
                          ? theme.colors.content.inverse
                          : theme.colors.content.primary
                      }
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.amountBlock}>
            <View
              testID="transaction-edit-amount-unit"
              style={styles.amountEditor}
            >
              <TextInput
                accessibilityLabel={translate('coreFinance.form.amount')}
                autoFocus={!transaction}
                keyboardType="decimal-pad"
                editable={!transaction || !deleted}
                onChangeText={setAmount}
                selectTextOnFocus
                style={[
                  styles.amountInput,
                  {
                    color: theme.colors.content.primary,
                    width: Math.min(300, Math.max(40, amount.length * 27))
                  }
                ]}
                value={amount}
              />
              <Text
                style={[
                  styles.currency,
                  { color: theme.colors.content.primary }
                ]}
              >
                {selectedCurrencyCode}
              </Text>
            </View>
          </View>
        </View>
        {type === 'transfer' ? null : (
          <TransactionPickerCard
            direction={direction}
            icon={categoryIconName(selectedCategory?.iconKey ?? null)}
            categoryVisualKey={selectedCategory?.iconKey ?? null}
            label={translate('coreFinance.transaction.category')}
            title={categoryLabel}
            disabled={Boolean(transaction && deleted)}
            onPress={() => void openPicker('category')}
          />
        )}
        <TransactionPickerCard
          direction={direction}
          icon="accounts"
          label={translate('coreFinance.transaction.account')}
          title={
            selectedAccount?.name ??
            translate('coreFinance.transaction.account')
          }
          subtitle={selectedAccount?.currencyCode}
          disabled={Boolean(transaction && deleted)}
          onPress={() => void openPicker('account')}
        />
        {type === 'transfer' ? (
          <TransactionPickerCard
            direction={direction}
            icon="transactions"
            label={translate('coreFinance.form.destination')}
            title={
              selectedDestination?.name ??
              translate('coreFinance.form.destination')
            }
            subtitle={selectedDestination?.currencyCode}
            disabled={Boolean(transaction && deleted)}
            onPress={() => void openPicker('destination')}
          />
        ) : null}
        <FormField
          label={translate('coreFinance.form.title')}
          editable={!transaction || !deleted}
          value={title}
          onChangeText={setTitle}
        />
        <FormField
          label={translate('coreFinance.form.note')}
          editable={!transaction || !deleted}
          maxLength={500}
          multiline
          numberOfLines={3}
          placeholder={translate('coreFinance.form.notePlaceholder')}
          style={styles.noteInput}
          value={notes}
          onChangeText={setNotes}
        />
        <TransactionDateField
          value={occurredAt}
          disabled={Boolean(transaction && deleted)}
          onChange={setOccurredAt}
        />
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ color: theme.colors.status.danger }}
          >
            {error}
          </Text>
        ) : null}
        {transaction ? (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.content.primary }
              ]}
            >
              {translate('coreFinance.transaction.information')}
            </Text>
            <GroupedList
              label={translate('coreFinance.transaction.information')}
            >
              <NavigationRow
                label={translate('coreFinance.transaction.source')}
                value={translate(
                  `coreFinance.source.${transaction.source}` as never
                )}
              />
              <NavigationRow
                label={translate('coreFinance.transaction.recordStatus')}
                value={translate(
                  `coreFinance.status.${transaction.status}` as never
                )}
              />
              <NavigationRow
                label={translate('coreFinance.transaction.reviewStatus')}
                value={translate(
                  `coreFinance.transaction.review.${transaction.reviewStatus}` as never
                )}
              />
              <NavigationRow
                label={translate('coreFinance.transaction.status')}
                value={translate(
                  `coreFinance.sync.${transaction.syncStatus}` as never
                )}
              />
              {transaction.originalTransactionId ? (
                <NavigationRow
                  label={translate('coreFinance.transaction.original')}
                  value={transaction.originalTransactionId}
                  onPress={() =>
                    router.push(
                      `/transactions/${transaction.originalTransactionId}`
                    )
                  }
                />
              ) : null}
              {transaction.obligationId ? (
                <NavigationRow
                  label={translate('coreFinance.transaction.obligation')}
                  value={transaction.obligationId}
                  onPress={() =>
                    router.push(`/obligations/${transaction.obligationId}`)
                  }
                />
              ) : null}
            </GroupedList>
            <TransactionActions
              transaction={transaction}
              onDeletedChange={setDeleted}
            />
          </>
        ) : null}
      </ScrollView>
      {transaction ? pickerSheets : null}
    </View>
  );
}

function TransactionPickerCard({
  direction,
  icon,
  categoryVisualKey,
  label,
  title,
  subtitle,
  disabled = false,
  onPress
}: {
  direction: 'ltr' | 'rtl';
  icon: DesignIconName;
  categoryVisualKey?: string | null;
  label: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fieldStack}>
      <Text
        style={[
          styles.fieldLabel,
          {
            color: theme.colors.content.primary,
            textAlign: direction === 'rtl' ? 'right' : 'left'
          }
        ]}
      >
        {label}
      </Text>
      <Pressable
        accessibilityLabel={`${label}, ${title}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pickerCard,
          {
            backgroundColor: pressed
              ? theme.colors.interactions.quietPressed
              : theme.colors.surfaces.card,
            borderColor: theme.colors.borders.subtle,
            direction: 'ltr',
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
            opacity: disabled ? 0.56 : 1
          }
        ]}
      >
        {categoryVisualKey !== undefined ? (
          <CategoryIcon
            label={title}
            icon={icon}
            size="sm"
            visualKey={categoryVisualKey}
          />
        ) : (
          <View
            style={[
              styles.pickerIcon,
              { backgroundColor: theme.colors.surfaces.brandSubtle }
            ]}
          >
            <DesignIcon
              name={icon}
              label={label}
              color={theme.colors.content.link}
              decorative
            />
          </View>
        )}
        <View style={styles.pickerText}>
          <Text
            numberOfLines={2}
            style={[
              styles.pickerTitle,
              {
                color: theme.colors.content.primary,
                textAlign: direction === 'rtl' ? 'right' : 'left'
              }
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.pickerSubtitle,
                {
                  color: theme.colors.content.secondary,
                  textAlign: direction === 'rtl' ? 'right' : 'left'
                }
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <DesignIcon
          name="chevronEnd"
          label={label}
          color={theme.colors.content.muted}
          direction={direction}
          decorative
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  editRoot: { flex: 1 },
  editHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    writingDirection: 'ltr',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.md
  },
  headerAction: {
    alignItems: 'center',
    height: minTouchTarget,
    justifyContent: 'center',
    width: minTouchTarget
  },
  editTitle: {
    ...typography.title,
    flex: 1,
    textAlign: 'center'
  },
  editStack: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  editHero: {
    gap: spacing.xl,
    paddingBottom: spacing.sm
  },
  typeSelector: {
    flexWrap: 'nowrap',
    gap: spacing.sm,
    writingDirection: 'ltr'
  },
  typeOption: {
    alignItems: 'center',
    borderRadius: radius.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: minTouchTarget,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center'
  },
  amountBlock: {
    alignItems: 'center',
    minHeight: 104,
    justifyContent: 'center'
  },
  amountEditor: {
    alignItems: 'baseline',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: '100%',
    justifyContent: 'center'
  },
  amountInput: {
    ...typography.headline,
    fontSize: 46,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    lineHeight: 58,
    maxWidth: 300,
    minWidth: 40,
    padding: 0,
    textAlign: 'right',
    writingDirection: 'ltr'
  },
  currency: {
    ...typography.title,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr'
  },
  fieldStack: { gap: spacing.sm },
  fieldLabel: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  pickerCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    writingDirection: 'ltr',
    gap: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  pickerIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  pickerText: { flex: 1, gap: spacing.xs },
  pickerTitle: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  pickerSubtitle: { fontSize: 14, lineHeight: 20 },
  noteInput: {
    minHeight: 88,
    paddingTop: spacing.md,
    textAlignVertical: 'top'
  },
  sectionTitle: { ...typography.subtitle }
});
