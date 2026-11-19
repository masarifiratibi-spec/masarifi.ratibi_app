import { useState } from 'react';
import { ActionSheetIOS, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { FormField } from '@/design-system/components/forms/FormField';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import type {
  BankSmsAccountChoice,
  BankSmsAccountLink,
  BankSmsConfiguration
} from '@/services/platform/bank-sms-bridge.ios';
import type { readBankSmsSetup } from '@/services/platform/bank-sms-setup.ios';
import { usePreferenceStore } from '@/state/preferences';

type Setup = Awaited<ReturnType<typeof readBankSmsSetup>>;
const defaults = [
  {
    key: 'expenseId',
    kind: 'expense',
    label: 'tracking.bankSms.expenseDefault'
  },
  { key: 'incomeId', kind: 'income', label: 'tracking.bankSms.incomeDefault' },
  { key: 'feeId', kind: 'expense', label: 'tracking.bankSms.feeDefault' },
  { key: 'salaryId', kind: 'income', label: 'tracking.bankSms.salaryDefault' }
] as const;

export function BankSmsSetupFields({
  setup,
  value,
  onChange,
  disabled
}: {
  setup: Setup;
  value?: BankSmsConfiguration;
  onChange: (configuration: BankSmsConfiguration) => void;
  disabled: boolean;
}) {
  const locale = usePreferenceStore((state) => state.locale);
  const [editing, setEditing] = useState<string>();
  const accounts = setup.accounts ?? [];
  const linked = accounts.filter((account) => account.automaticRouting);
  const account = linked.find((choice) => choice.id === editing);
  const choices = setup.categories ?? [];
  const draft = value ?? {
    ...setup.preferences,
    links: Object.fromEntries(
      linked.map(({ id, accountEnding, issuer, cashAccountId }) => [
        id,
        { accountEnding, issuer, cashAccountId }
      ])
    )
  };
  const updateLink = (
    current: BankSmsAccountChoice,
    patch: BankSmsAccountLink
  ) => {
    onChange({
      ...draft,
      links: {
        ...draft.links,
        [current.id]: { ...draft.links?.[current.id], ...patch }
      }
    });
  };
  const pick = (labels: string[], select: (index: number) => void) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, translate('designSystem.action.cancel')],
        cancelButtonIndex: labels.length
      },
      (index) => {
        if (index < labels.length) select(index);
      }
    );
  };
  const categoryName = (choice: (typeof choices)[number]) =>
    (locale === 'ar' ? choice.nameAr : choice.nameEn) ?? choice.name;
  const link = account && draft.links?.[account.id];
  const incomplete = linked.filter(({ id }) => {
    const length = draft.links?.[id]?.accountEnding?.length;
    return length && length !== 4;
  });
  const cashAccounts = accounts.filter(
    (choice) => choice.type === 'cash' && choice.currency === account?.currency
  );
  return (
    <View style={{ gap: spacing.md }}>
      <StyledText variant="subtitle">
        {translate('tracking.bankSms.destinations')}
      </StyledText>
      <StyledText>{translate('tracking.bankSms.destinationsHelp')}</StyledText>
      {linked.length ? (
        <PickerField
          label={translate('tracking.bankSms.linkAccount')}
          placeholder={translate('tracking.bankSms.chooseAccount')}
          value={account?.name}
          disabled={disabled}
          onPress={() =>
            pick(
              linked.map((choice) => choice.name),
              (index) => setEditing(linked[index].id)
            )
          }
        />
      ) : (
        <StyledText>
          {translate('tracking.bankSms.noTrackingAccounts')}
        </StyledText>
      )}
      {account && (
        <View style={{ gap: spacing.sm }}>
          {account.lastFour && (
            <StyledText>
              {translate('tracking.bankSms.savedCardDigits')} {account.lastFour}
            </StyledText>
          )}
          <FormField
            label={translate('tracking.bankSms.accountDigits')}
            value={link?.accountEnding ?? ''}
            errorText={incomplete.some((choice) => choice.id === account.id)
              ? 'tracking.bankSms.fourDigitsRequired' : undefined}
            keyboardType="number-pad"
            maxLength={4}
            editable={!disabled}
            onChangeText={(text) =>
              updateLink(account, {
                accountEnding: text.replace(/[^0-9٠-٩۰-۹]/g, '')
              })
            }
          />
          <FormField
            label={translate('tracking.bankSms.issuer')}
            value={link?.issuer ?? ''}
            editable={!disabled}
            autoCorrect={false}
            maxLength={64}
            placeholder={account.institution ?? undefined}
            onChangeText={(issuer) => updateLink(account, { issuer })}
          />
          {cashAccounts.length > 0 && (
            <PickerField
              label={translate('tracking.bankSms.cashAccount')}
              value={
                cashAccounts.find((choice) => choice.id === link?.cashAccountId)
                  ?.name
              }
              placeholder={translate('tracking.bankSms.noCashAccount')}
              disabled={disabled}
              onPress={() =>
                pick(
                  [
                    translate('tracking.bankSms.noCashAccount'),
                    ...cashAccounts.map((choice) => choice.name)
                  ],
                  (index) =>
                    updateLink(account, {
                      cashAccountId: cashAccounts[index - 1]?.id
                    })
                )
              }
            />
          )}
        </View>
      )}
      {incomplete.filter((choice) => choice.id !== account?.id).map((choice) => (
        <StyledText key={choice.id} accessibilityRole="alert">
          {choice.name} · {translate('tracking.bankSms.fourDigitsRequired')}
        </StyledText>
      ))}
      {defaults.map(({ key, kind, label }) => {
        const matching = choices.filter((choice) => choice.kind === kind);
        const active = matching.find((choice) => choice.id === draft[key]);
        return (
          <PickerField
            key={key}
            label={translate(label)}
            value={active && categoryName(active)}
            disabled={disabled || !matching.length}
            onPress={() =>
              pick(matching.map(categoryName), (index) =>
                onChange({ ...draft, [key]: matching[index].id })
              )
            }
          />
        );
      })}
    </View>
  );
}
