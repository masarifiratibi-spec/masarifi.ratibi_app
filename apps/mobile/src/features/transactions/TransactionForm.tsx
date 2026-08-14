import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { FormField } from '@/design-system/components/forms/FormField';
import { RadioCard } from '@/design-system/components/forms/SelectionControls';
import {
  parseAmountToMinor,
  transactionTypes,
  type Account,
  type Category,
  type Transaction,
  type TransactionType
} from '@/domain/core-finance';
import {
  invalidateCoreFinanceScopes,
  useAccounts,
  useCategories
} from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';
import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { useTransactionDraftGuard } from './useTransactionDraftGuard';

const supportedTypes = transactionTypes.filter((type) =>
  ['expense', 'income', 'transfer', 'refund', 'obligation_payment'].includes(
    type
  )
);
const MANUAL_DRAFT_ID = 'manual-entry';

export function TransactionForm({
  initialType = 'expense',
  transaction
}: {
  initialType?: TransactionType;
  transaction?: Transaction;
}) {
  const accounts = useAccounts();
  const categories = useCategories();
  const client = useQueryClient();
  const locale = currentLocale();
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? initialType
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amountMinor / 100) : ''
  );
  const [title, setTitle] = useState(transaction?.title ?? '');
  const [accountId, setAccountId] = useState(transaction?.accountId ?? '');
  const [destinationAccountId, setDestination] = useState(
    transaction?.destinationAccountId ?? ''
  );
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(Boolean(transaction));
  const meaningful = Boolean(
    amount || title || accountId || destinationAccountId || categoryId
  );
  const discard = useCallback(
    () => coreFinanceService.discardDraft(MANUAL_DRAFT_ID),
    []
  );
  const requestClose = useTransactionDraftGuard({ meaningful, discard });

  useEffect(() => {
    if (transaction) return;
    void coreFinanceService
      .loadDraft(MANUAL_DRAFT_ID)
      .then((draft) => {
        if (draft) {
          setType(draft.transactionType ?? initialType);
          setAmount(draft.amountText);
          setTitle(draft.merchant ?? '');
          setAccountId(draft.accountId ?? '');
          setDestination(draft.destinationAccountId ?? '');
          setCategoryId(draft.categoryId ?? '');
        }
      })
      .catch(() => setError(translate('coreFinance.state.error')))
      .finally(() => setDraftReady(true));
  }, [initialType, transaction]);

  useEffect(() => {
    if (!draftReady || transaction || !meaningful) return;
    const timeout = setTimeout(() => {
      void coreFinanceService
        .saveDraft({
          id: MANUAL_DRAFT_ID,
          transactionType: type,
          amountText: amount,
          accountId: accountId || null,
          destinationAccountId: destinationAccountId || null,
          categoryId: categoryId || null,
          merchant: title || null,
          notes: null,
          occurredAt: Date.now(),
          status: 'editing',
          updatedAt: Date.now()
        })
        .catch(() => setError(translate('coreFinance.state.error')));
    }, 250);
    return () => clearTimeout(timeout);
  }, [
    accountId,
    amount,
    categoryId,
    destinationAccountId,
    draftReady,
    meaningful,
    title,
    transaction,
    type
  ]);
  const save = async () => {
    const amountMinor = parseAmountToMinor(amount);
    const resolvedAccount = accountId || accounts.data?.[0]?.id;
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
        currencyCode:
          accounts.data?.find((item: Account) => item.id === resolvedAccount)
            ?.currencyCode ?? 'SAR',
        accountId: resolvedAccount,
        destinationAccountId:
          type === 'transfer' ? destinationAccountId || null : null,
        feeMinor: 0,
        categoryId: type === 'transfer' ? null : resolvedCategory,
        title,
        merchant: null,
        occurredAt: transaction?.occurredAt ?? Date.now(),
        notes: null,
        originalTransactionId: transaction?.originalTransactionId ?? null,
        obligationId: transaction?.obligationId ?? null
      };
      const result = transaction
        ? await coreFinanceService.updateTransaction(transaction.id, input)
        : await coreFinanceService.createTransaction(
            input,
            `manual-${Date.now()}`
          );
      await invalidateCoreFinanceScopes(client, result.affectedScopes);
      if (!transaction) await discard();
      router.replace('/(tabs)/transactions');
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
  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      keyboardShouldPersistTaps="handled"
    >
      <StyledText variant="title">
        {translate(
          transaction ? 'coreFinance.transaction.edit' : 'appShell.tabs.add'
        )}
      </StyledText>
      {supportedTypes.map((item) => (
        <RadioCard
          key={item}
          label={translate(`coreFinance.type.${item}` as never)}
          selected={type === item}
          onPress={() => setType(item)}
        />
      ))}
      <FormField
        label={translate('coreFinance.form.amount')}
        value={amount}
        onChangeText={setAmount}
        variant="amount"
        errorText={error}
        autoFocus
      />
      <FormField
        label={translate('coreFinance.form.title')}
        value={title}
        onChangeText={setTitle}
      />
      {accounts.data?.map((account: Account) => (
        <RadioCard
          key={account.id}
          label={`${account.name} · ${account.currencyCode}`}
          selected={(accountId || accounts.data?.[0]?.id) === account.id}
          onPress={() => setAccountId(account.id)}
        />
      ))}
      {type === 'transfer'
        ? accounts.data
            ?.filter(
              (account: Account) =>
                account.id !== (accountId || accounts.data?.[0]?.id)
            )
            .map((account: Account) => (
              <RadioCard
                key={`to-${account.id}`}
                label={`${translate('coreFinance.form.destination')} · ${account.name}`}
                selected={destinationAccountId === account.id}
                onPress={() => setDestination(account.id)}
              />
            ))
        : categories.data
            ?.slice(0, 8)
            .map((category: Category) => (
              <RadioCard
                key={category.id}
                label={locale === 'ar' ? category.labelAr : category.labelEn}
                selected={
                  (categoryId || categories.data?.[0]?.id) === category.id
                }
                onPress={() => setCategoryId(category.id)}
              />
            ))}
      <ActionButton
        label={translate('coreFinance.form.save')}
        loading={saving}
        onPress={() => void save()}
      />
      <ActionButton
        label={translate('coreFinance.cancel')}
        variant="quiet"
        onPress={requestClose}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10, padding: 16, paddingBottom: 40 }
});
