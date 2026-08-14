import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { FormField } from '@/design-system/components/forms/FormField';
import {
  CheckboxRow,
  RadioCard
} from '@/design-system/components/forms/SelectionControls';
import type {
  Account,
  Category
} from '@/domain/core-finance';
import type {
  VoiceField,
  VoiceTransactionProposal
} from '@/domain/voice-capture';
import { translate, currentLocale } from '@/localization/i18n';
import { formatAmount, formatDate } from '@/utils/format-financial-value';
import { VoiceRecurringReview } from './VoiceRecurringReview';

const paymentMethods = ['cash', 'card', 'transfer', 'wallet', 'apple_pay', 'google_pay'] as const;
const transactionTypes = ['expense', 'income', 'transfer', 'obligation_payment'] as const;

function resolveField(
  proposal: VoiceTransactionProposal,
  field: VoiceField
): VoiceTransactionProposal['assessments'] {
  return proposal.assessments.map((item) =>
    item.field === field ? { ...item, status: 'clear', confidence: 100, confirmed: true } : item
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
  const uncertain = proposal.assessments.filter(
    (item) => item.status !== 'clear' && !item.confirmed
  );
  return (
    <SurfaceCard style={styles.stack}>
      <CheckboxRow
        label={translate('voice.review.select')}
        checked={proposal.selected}
        onPress={() => onChange({ selected: !proposal.selected })}
      />
      <View style={styles.options}>
        {transactionTypes.map((type) => (
          <RadioCard
            key={type}
            label={translate(`coreFinance.type.${type}` as never)}
            selected={proposal.type === type}
            onPress={() =>
              onChange({ type, assessments: resolveField(proposal, 'type') })
            }
          />
        ))}
      </View>
      <FormField
        label={translate('voice.review.amount')}
        variant="amount"
        value={proposal.amountMinor ? String(proposal.amountMinor / 100) : ''}
        onChangeText={(text) => {
          const parsed = Number(text.replaceAll(',', ''));
          onChange({
            amountMinor: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null,
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
          onChange({ merchant, title: merchant, assessments: resolveField(proposal, 'merchant') })
        }
      />
      <StyledText variant="caption">
        {proposal.amountMinor && proposal.currencyCode
          ? formatAmount(proposal.amountMinor / 100, proposal.currencyCode, currentLocale())
          : translate('voice.review.missing')}
      </StyledText>
      <StyledText variant="subtitle">{translate('voice.review.paymentMethod')}</StyledText>
      <View style={styles.options}>
        {paymentMethods.map((method) => (
          <RadioCard
            key={method}
            label={translate(`voice.payment.${method}` as never)}
            selected={proposal.paymentMethod === method}
            onPress={() =>
              onChange({ paymentMethod: method, assessments: resolveField(proposal, 'payment_method') })
            }
          />
        ))}
      </View>
      <StyledText variant="subtitle">{translate('voice.review.account')}</StyledText>
      {accounts.map((account) => (
        <RadioCard
          key={account.id}
          label={account.name}
          selected={proposal.accountId === account.id}
          onPress={() =>
            onChange({ accountId: account.id, assessments: resolveField(proposal, 'account') })
          }
        />
      ))}
      {proposal.type === 'transfer' ? (
        <>
          <StyledText variant="subtitle">{translate('coreFinance.form.destination')}</StyledText>
          {accounts
            .filter((account) => account.id !== proposal.accountId)
            .map((account) => (
              <RadioCard
                key={`destination-${account.id}`}
                label={account.name}
                selected={proposal.destinationAccountId === account.id}
                onPress={() => onChange({ destinationAccountId: account.id })}
              />
            ))}
        </>
      ) : null}
      {proposal.type !== 'transfer' ? (
        <>
          <StyledText variant="subtitle">{translate('voice.review.category')}</StyledText>
          <View style={styles.options}>
            {categories.slice(0, 8).map((category) => (
              <RadioCard
                key={category.id}
                label={currentLocale() === 'ar' ? category.labelAr : category.labelEn}
                selected={proposal.categoryId === category.id}
                onPress={() =>
                  onChange({
                    categoryId: category.id,
                    assessments: resolveField(proposal, 'category')
                  })
                }
              />
            ))}
          </View>
          {proposal.merchant ? (
            <View style={styles.stack}>
              <StyledText>{translate('voice.category.prompt')}</StyledText>
              {(['only_this_time', 'always_for_merchant', 'not_now'] as const).map((choice) => (
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
      {proposal.occurredAt ? (
        <StyledText>
          {translate('voice.review.date')}: {formatDate(proposal.occurredAt, currentLocale())}
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
  options: { gap: 8 },
  uncertain: { gap: 6 }
});
