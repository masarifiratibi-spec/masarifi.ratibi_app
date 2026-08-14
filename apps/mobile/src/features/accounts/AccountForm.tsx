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
import {
  accountTypes,
  parseAmountToMinor,
  type Account,
  type AccountType
} from '@/domain/core-finance';
import { translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { invalidateCoreFinanceScopes } from '@/features/core-finance/core-finance-queries';

export function AccountForm({ account }: { account?: Account }) {
  const client = useQueryClient();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  const [currency, setCurrency] = useState(account?.currencyCode ?? 'SAR');
  const [balance, setBalance] = useState(
    account ? String(account.openingBalanceMinor / 100) : '0'
  );
  const [isDefault, setDefault] = useState(account?.isDefault ?? false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!account) return;
    setName(account.name);
    setType(account.type);
    setCurrency(account.currencyCode);
    setBalance(String(account.openingBalanceMinor / 100));
    setDefault(account.isDefault);
    setError(undefined);
  }, [account]);

  const save = async () => {
    const openingBalanceMinor = parseAmountToMinor(balance);
    if (!name.trim() || openingBalanceMinor === null) {
      setError(translate('coreFinance.validation.required'));
      return;
    }
    const input = {
      name,
      type,
      currencyCode: currency.toUpperCase(),
      openingBalanceMinor,
      institution: null,
      lastFour: null,
      creditLimitMinor: null,
      isDefault,
      notes: null
    };
    setSaving(true);
    setError(undefined);
    try {
      const result = account
        ? await coreFinanceService.updateAccount(account.id, input)
        : await coreFinanceService.createAccount(input);
      await invalidateCoreFinanceScopes(client, result.affectedScopes);
      router.replace('/accounts');
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
        label={translate('coreFinance.accounts.name')}
        value={name}
        onChangeText={setName}
        errorText={error}
        autoFocus
      />
      {accountTypes.map((item) => (
        <RadioCard
          key={item}
          label={translate(`coreFinance.accountType.${item}` as never)}
          selected={type === item}
          onPress={() => setType(item)}
        />
      ))}
      <FormField
        label={translate('coreFinance.accounts.currency')}
        value={currency}
        onChangeText={setCurrency}
        editable={!account}
      />
      <FormField
        label={translate('coreFinance.accounts.openingBalance')}
        value={balance}
        onChangeText={setBalance}
        variant="amount"
      />
      <SwitchRow
        label={translate('coreFinance.accounts.makeDefault')}
        value={isDefault}
        onValueChange={setDefault}
      />
      <ActionButton
        label={translate('coreFinance.accounts.save')}
        loading={saving}
        onPress={() => void save()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10, padding: 16, paddingBottom: 40 }
});
