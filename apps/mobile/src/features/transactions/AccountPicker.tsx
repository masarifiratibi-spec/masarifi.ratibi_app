import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FormField } from '@/design-system/components/forms/FormField';
import { RadioCard } from '@/design-system/components/forms/SelectionControls';
import type { Account } from '@/domain/core-finance';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';

export function AccountPicker({
  selectedId,
  onSelect
}: {
  selectedId?: string;
  onSelect?: (account: Account) => void;
}) {
  const accounts = useAccounts(true);
  const [search, setSearch] = useState('');
  const filtered = useMemo<Account[]>(
    () =>
      (accounts.data ?? []).filter(
        (account: Account) =>
          account.status === 'active' &&
          `${account.name} ${account.currencyCode} ${account.lastFour ?? ''}`
            .toLocaleLowerCase('en')
            .includes(search.trim().toLocaleLowerCase('en'))
      ),
    [accounts.data, search]
  );
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <FormField
        label={translate('coreFinance.accounts.search')}
        value={search}
        onChangeText={setSearch}
        variant="search"
      />
      {filtered.map((account: Account) => (
        <RadioCard
          key={account.id}
          label={`${account.name} ${account.currencyCode}${account.lastFour ? ` ${account.lastFour}` : ''}`}
          selected={selectedId === account.id}
          onPress={() => onSelect?.(account)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ stack: { gap: 10, padding: 16 } });
