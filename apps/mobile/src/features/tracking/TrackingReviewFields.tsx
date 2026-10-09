import React, { useState } from 'react';
import { View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { FormField } from '@/design-system/components/forms/FormField';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { Toggle } from '@/design-system/components/forms/SelectionControls';
import { SelectionList } from '@/design-system/components/selection/SelectionList';
import {
  useAccounts,
  useTransactions
} from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';

export function TrackingReviewFields({
  proposed,
  edits,
  onChange
}: {
  proposed: Record<string, unknown>;
  edits: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const accounts = useAccounts();
  const transactions = useTransactions();
  const [open, setOpen] = useState<string | null>(null);
  const ar = currentLocale() === 'ar';
  const direction = ar ? 'rtl' : 'ltr';
  const values = { ...proposed, ...edits };
  const classification = proposed.classification as
    | {
        instruments?: { role: string; suffix: string }[];
        direction?: string;
        subtype?: string;
        status?: string;
        timeProvenance?: string;
      }
    | undefined;
  const change = (key: string, value: unknown) =>
    onChange({ ...edits, [key]: value });
  const accountOptions = (accounts.data ?? [])
    .filter((a) => a.status === 'active' && a.currencyCode === values.currency)
    .map((a) => ({ id: a.id, title: a.name }));
  const kindOptions = [
    { id: 'expense', title: ar ? 'مصروف' : 'Expense' },
    { id: 'income', title: ar ? 'دخل' : 'Income' },
    {
      id: 'transfer',
      title: ar ? 'تحويل بين الحسابات' : 'Transfer between accounts'
    }
  ];
  const select = (
    key: string,
    label: string,
    options: { id: string; title: string }[]
  ) => (
    <View key={key} style={{ gap: 8 }}>
      <PickerField
        label={label}
        value={options.find((o) => o.id === values[key])?.title}
        onPress={() => setOpen(open === key ? null : key)}
      />
      {open === key ? (
        <SelectionList
          direction={direction}
          items={options}
          selectedId={String(values[key] ?? '')}
          onSelect={(item) => {
            change(key, item.id);
            setOpen(null);
          }}
        />
      ) : null}
    </View>
  );
  const originalOptions = (transactions.data?.items ?? [])
    .filter(
      (t) =>
        (classification?.subtype === 'reversal' || t.type === 'expense') &&
        t.currencyCode === values.currency &&
        ['posted', 'refunded'].includes(t.status)
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: new Date(t.occurredAt).toLocaleDateString(ar ? 'ar' : 'en'),
      metadata: { version: t.version }
    }));
  return (
    <View style={{ gap: 12 }}>
      {select(
        'accountId',
        translate('coreFinance.transaction.account'),
        accountOptions
      )}
      {classification?.instruments?.length &&
      values.accountId &&
      typeof proposed.sourceProvider === 'string' ? (
        <View style={{ gap: 8 }}>
          <StyledText>
            {ar
              ? 'استخدام هذا الحساب للبطاقات والحسابات المقنّعة في الرسائل المستقبلية من هذا البنك'
              : 'Use this account for these masked instruments in future messages from this bank'}
          </StyledText>
          <Toggle
            accessibilityLabel={
              ar ? 'حفظ ربط الحساب' : 'Remember account binding'
            }
            value={edits.rememberAccountBinding === true}
            onValueChange={(value) => change('rememberAccountBinding', value)}
          />
        </View>
      ) : null}
      {!values.kind ||
      classification?.subtype === 'generic_credit' ||
      classification?.subtype === 'deposit' ||
      classification?.subtype === 'transfer_received' ||
      classification?.subtype === 'transfer_sent'
        ? select('kind', ar ? 'نوع المعاملة' : 'Transaction type', kindOptions)
        : null}
      {values.kind === 'transfer'
        ? select(
            'destinationAccountId',
            classification?.direction === 'incoming'
              ? ar
                ? 'الحساب المرسل'
                : 'Source account'
              : ar
                ? 'الحساب المستلم'
                : 'Destination account',
            accountOptions.filter(
              (o) =>
                o.id !== values.accountId &&
                (classification?.subtype !== 'withdrawal' ||
                  accounts.data?.find((a) => a.id === o.id)?.type === 'cash')
            )
          )
        : null}
      {['refund', 'reversal'].includes(String(values.kind)) ? (
        <View style={{ gap: 8 }}>
          <StyledText>
            {ar ? 'المعاملة الأصلية' : 'Original transaction'}
          </StyledText>
          <SelectionList
            direction={direction}
            items={originalOptions}
            selectedId={String(values.originalTransactionId ?? '')}
            onSelect={(item) =>
              onChange({
                ...edits,
                originalTransactionId: item.id,
                originalTransactionVersion: item.metadata?.version
              })
            }
          />
        </View>
      ) : null}
      {classification?.timeProvenance === 'ambiguous' ? (
        <FormField
          label={
            ar
              ? 'وقت المعاملة مع المنطقة الزمنية'
              : 'Transaction time with timezone'
          }
          helperText="2026-09-26T08:56:00+03:00"
          value={String(values.occurredAt ?? '')}
          onChangeText={(value) => change('occurredAt', value)}
        />
      ) : null}
      {classification && classification.status !== 'completed' ? (
        <View style={{ gap: 8 }}>
          <StyledText>
            {ar
              ? 'أؤكد أن المعاملة اكتملت وتم قيدها في البنك'
              : 'I confirm the transaction completed and was posted by the bank'}
          </StyledText>
          <Toggle
            accessibilityLabel={
              ar ? 'تأكيد اكتمال المعاملة' : 'Confirm settlement'
            }
            value={edits.settlementConfirmed === true}
            onValueChange={(value) => change('settlementConfirmed', value)}
          />
        </View>
      ) : null}
    </View>
  );
}
