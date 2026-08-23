import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import {
  AmountText,
  CategoryIcon
} from '@/design-system/components/financial/FinancialPrimitives';
import { FormField } from '@/design-system/components/forms/FormField';
import { ChipSelector } from '@/design-system/components/forms/ChipControls';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import {
  CheckboxRow,
  RadioCard
} from '@/design-system/components/forms/SelectionControls';
import { parseAmountToMinor, type Account, type Category } from '@/domain/core-finance';
import {
  minorToMajorAmountText
} from '@/domain/currencies';
import type {
  VoiceField,
  VoiceTransactionProposal
} from '@/domain/voice-capture';
import { spacing } from '@/design-system/tokens';
import { translate, currentLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { formatDate } from '@/utils/format-financial-value';
import { VoiceRecurringReview } from './VoiceRecurringReview';
import { AccountPicker } from '@/features/transactions/AccountPicker';
import { openCategorySelection } from '@/features/categories/category-selection-session';

const paymentMethods = [
  'cash',
  'card',
  'transfer',
  'wallet',
  'apple_pay',
  'google_pay'
] as const;
const transactionTypes = [
  'expense',
  'income',
  'transfer',
  'obligation_payment'
] as const;

function resolveField(
  proposal: VoiceTransactionProposal,
  field: VoiceField
): VoiceTransactionProposal['assessments'] {
  return proposal.assessments.map((item) =>
    item.field === field
      ? { ...item, status: 'clear', confidence: 100, confirmed: true }
      : item
  );
}

export function VoiceReview({
  proposal,
  accounts,
  categories,
  onChange,
  onConfirmField,
  onRemove
}: {
  proposal: VoiceTransactionProposal;
  accounts: Account[];
  categories: Category[];
  onChange(value: Partial<VoiceTransactionProposal>): void;
  onConfirmField(field: string): void;
  onRemove(): void;
}) {
  const direction = usePreferenceStore((state) => state.direction);
  const [picker, setPicker] = useState<'account' | 'destination' | null>(null);
  const uncertain = proposal.assessments.filter(
    (item) => item.status !== 'clear' && !item.confirmed
  );
  const locale = currentLocale();
  const selectedAccount = accounts.find(
    (item) => item.id === proposal.accountId
  );
  const accountName = selectedAccount?.name;
  const amountCurrencyCode =
    proposal.currencyCode ?? selectedAccount?.currencyCode ?? null;
  const destinationName = accounts.find(
    (item) => item.id === proposal.destinationAccountId
  )?.name;
  const category = categories.find((item) => item.id === proposal.categoryId);
  const categoryName = category
    ? locale === 'ar'
      ? category.labelAr
      : category.labelEn
    : undefined;
  const typeLabels = transactionTypes.map((type) =>
    translate(`coreFinance.type.${type}` as never)
  );
  const paymentLabels = paymentMethods.map((method) =>
    translate(`voice.payment.${method}` as never)
  );
  const typeLabel = translate(`coreFinance.type.${proposal.type}` as never);
  const amountMeaning =
    proposal.type === 'income'
      ? 'income'
      : proposal.type === 'transfer'
        ? 'transfer'
        : proposal.type === 'obligation_payment'
          ? 'debt'
          : 'expense';
  return (
    <SurfaceCard
      testID={`voice-review-card-${proposal.id}`}
      style={styles.stack}
    >
      <View
        testID={`voice-review-summary-${proposal.id}`}
        style={[
          styles.summary,
          { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }
        ]}
      >
        <CategoryIcon
          label={categoryName ?? typeLabel}
          visualKey={category?.iconKey ?? proposal.categoryId ?? proposal.type}
          size="md"
        />
        <View
          style={[
            styles.summaryCopy,
            { alignItems: direction === 'rtl' ? 'flex-end' : 'flex-start' }
          ]}
        >
          <StyledText variant="subtitle">
            {proposal.merchant ??
              proposal.title ??
              proposal.beneficiary ??
              typeLabel}
          </StyledText>
          <StyledText variant="caption">{typeLabel}</StyledText>
          {categoryName || accountName ? (
            <StyledText variant="caption">
              {[categoryName, accountName].filter(Boolean).join(' · ')}
            </StyledText>
          ) : null}
          {uncertain.length ? (
            <StyledText variant="caption">
              {translate('voice.review.needsConfirmation')}
            </StyledText>
          ) : null}
        </View>
      </View>
      <View
        style={{ alignItems: direction === 'rtl' ? 'flex-end' : 'flex-start' }}
      >
        {proposal.amountMinor !== null && proposal.currencyCode ? (
          <AmountText
            minorUnits={proposal.amountMinor}
            currency={proposal.currencyCode}
            meaning={amountMeaning}
            size="row"
          />
        ) : (
          <StyledText>{translate('voice.review.missing')}</StyledText>
        )}
      </View>
      <CheckboxRow
        label={translate('voice.review.select')}
        checked={proposal.selected}
        onPress={() => onChange({ selected: !proposal.selected })}
      />
      <ChipSelector
        options={typeLabels}
        selected={[translate(`coreFinance.type.${proposal.type}` as never)]}
        onToggle={(label) => {
          const index = typeLabels.indexOf(label);
          if (index >= 0)
            onChange({
              type: transactionTypes[index],
              assessments: resolveField(proposal, 'type')
            });
        }}
      />
      <FormField
        label={translate('voice.review.amount')}
        variant="amount"
        value={
          proposal.amountMinor !== null && amountCurrencyCode
            ? minorToMajorAmountText(
                proposal.amountMinor,
                amountCurrencyCode
              )
            : ''
        }
        onChangeText={(text) => {
          const parsed = amountCurrencyCode
            ? parseAmountToMinor(text, amountCurrencyCode)
            : null;
          onChange({
            amountMinor:
              parsed !== null && parsed > 0
                ? parsed
                : null,
            assessments: resolveField(proposal, 'amount')
          });
        }}
      />
      <FormField
        label={translate('voice.review.currency')}
        value={proposal.currencyCode ?? ''}
        autoCapitalize="characters"
        maxLength={3}
        onChangeText={(currencyCode) =>
          onChange({
            currencyCode: currencyCode.trim().toUpperCase() || null,
            assessments: resolveField(proposal, 'currency')
          })
        }
      />
      <FormField
        label={translate('voice.review.merchant')}
        value={proposal.merchant ?? ''}
        onChangeText={(merchant) =>
          onChange({
            merchant,
            title: merchant,
            assessments: resolveField(proposal, 'merchant')
          })
        }
      />
      <StyledText variant="subtitle">
        {translate('voice.review.paymentMethod')}
      </StyledText>
      <ChipSelector
        options={paymentLabels}
        selected={
          proposal.paymentMethod
            ? [translate(`voice.payment.${proposal.paymentMethod}` as never)]
            : []
        }
        onToggle={(label) => {
          const index = paymentLabels.indexOf(label);
          if (index >= 0)
            onChange({
              paymentMethod: paymentMethods[index],
              assessments: resolveField(proposal, 'payment_method')
            });
        }}
      />
      <PickerField
        label={translate('voice.review.account')}
        value={accountName}
        placeholder={translate('voice.review.missing')}
        onPress={() => setPicker('account')}
      />
      {proposal.type === 'transfer' ? (
        <PickerField
          label={translate('coreFinance.form.destination')}
          value={destinationName}
          placeholder={translate('voice.review.missing')}
          onPress={() => setPicker('destination')}
        />
      ) : null}
      {proposal.type !== 'transfer' ? (
        <>
          <PickerField
            label={translate('voice.review.category')}
            value={categoryName}
            placeholder={translate('voice.review.missing')}
            onPress={() =>
              openCategorySelection({
                selectedId: proposal.categoryId ?? undefined,
                onSelect: (categoryId) => {
                  if (!categoryId) return;
                  onChange({
                    categoryId,
                    assessments: resolveField(proposal, 'category')
                  });
                }
              })
            }
          />
          {proposal.merchant ? (
            <View style={styles.stack}>
              <StyledText>{translate('voice.category.prompt')}</StyledText>
              {(
                ['only_this_time', 'always_for_merchant', 'not_now'] as const
              ).map((choice) => (
                <RadioCard
                  key={choice}
                  label={translate(
                    choice === 'only_this_time'
                      ? 'voice.category.once'
                      : choice === 'always_for_merchant'
                        ? 'voice.category.always'
                        : 'voice.category.notNow'
                  )}
                  selected={proposal.categoryPreference === choice}
                  onPress={() => onChange({ categoryPreference: choice })}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      {picker === 'account' || picker === 'destination' ? (
        <AppSheet
          title={translate(
            picker === 'destination'
              ? 'coreFinance.form.destination'
              : 'voice.review.account'
          )}
          visible
          onDismiss={() => setPicker(null)}
        >
          <AccountPicker
            excludedIds={
              picker === 'destination' && proposal.accountId
                ? [proposal.accountId]
                : []
            }
            selectedId={
              picker === 'destination'
                ? (proposal.destinationAccountId ?? undefined)
                : (proposal.accountId ?? undefined)
            }
            onSelect={(account) => {
              if (picker === 'destination') {
                onChange({ destinationAccountId: account.id });
              } else {
                onChange({
                  accountId: account.id,
                  destinationAccountId:
                    proposal.destinationAccountId === account.id
                      ? null
                      : proposal.destinationAccountId,
                  assessments: resolveField(proposal, 'account')
                });
              }
              setPicker(null);
            }}
          />
        </AppSheet>
      ) : null}
      {proposal.occurredAt ? (
        <StyledText>
          {translate('voice.review.date')}:{' '}
          {formatDate(proposal.occurredAt, currentLocale())}
        </StyledText>
      ) : null}
      {uncertain.map((item) => (
        <View key={item.field} style={styles.uncertain}>
          <StyledText>
            {translate(
              item.status === 'confirm'
                ? 'voice.review.needsConfirmation'
                : 'voice.review.missing'
            )}
          </StyledText>
          {item.status === 'confirm' ? (
            <ActionButton
              label={translate('voice.review.confirmField')}
              variant="secondary"
              onPress={() => onConfirmField(item.field)}
            />
          ) : null}
        </View>
      ))}
      {proposal.recurringSuggestion ? (
        <VoiceRecurringReview
          value={proposal.recurringSuggestion}
          onChange={(recurringSuggestion) =>
            onChange({
              recurringSuggestion,
              obligationId:
                recurringSuggestion.kind === 'existing_obligation' &&
                recurringSuggestion.candidateObligationIds.length === 1
                  ? recurringSuggestion.candidateObligationIds[0]
                  : null
            })
          }
        />
      ) : null}
      <ActionButton
        label={translate('voice.review.remove')}
        variant="quiet"
        onPress={onRemove}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  summary: { alignItems: 'center', gap: spacing.md },
  summaryCopy: { flex: 1, gap: spacing.xs },
  uncertain: { gap: 6 }
});
