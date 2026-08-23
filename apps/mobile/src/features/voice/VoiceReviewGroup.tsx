import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import type { Account, Category } from '@/domain/core-finance';
import type { VoiceProposalGroup, VoiceTransactionProposal } from '@/domain/voice-capture';
import { translate, translateDynamic } from '@/localization/i18n';
import { VoiceReview } from './VoiceReview';

export function VoiceReviewGroup({
  group,
  accounts,
  categories,
  onChange,
  onConfirmField,
  onRemove,
  onSave,
  onSaveAll,
  onReRecord
}: {
  group: VoiceProposalGroup;
  accounts: Account[];
  categories: Category[];
  onChange(id: string, value: Partial<VoiceTransactionProposal>): void;
  onConfirmField(id: string, field: string): void;
  onRemove(id: string): void;
  onSave(): void;
  onSaveAll(): void;
  onReRecord(): void;
}) {
  const visible = group.proposals.filter((item) => item.status !== 'removed');
  const selected = visible.filter((item) => item.selected).length;
  return (
    <View style={styles.stack}>
      <StyledText variant="subtitle">
        {translateDynamic('voice.review.groupSummary', {
          selected,
          total: visible.length
        })}
      </StyledText>
      {visible.map((proposal, index) => (
        <View key={proposal.id} style={styles.proposal}>
          <StyledText variant="subtitle">
            {translateDynamic('voice.review.proposalPosition', {
              current: index + 1,
              total: visible.length
            })}
          </StyledText>
          <VoiceReview
            proposal={proposal}
            accounts={accounts}
            categories={categories}
            onChange={(value) => onChange(proposal.id, value)}
            onConfirmField={(field) => onConfirmField(proposal.id, field)}
            onRemove={() => onRemove(proposal.id)}
          />
        </View>
      ))}
      <ActionButton
        label={translate('voice.review.confirmSelected')}
        onPress={onSave}
        disabled={!visible.some((item) => item.selected)}
      />
      <ActionButton
        label={translate('voice.review.confirmAll')}
        variant="secondary"
        onPress={onSaveAll}
      />
      <ActionButton
        label={translate('voice.record.rerecord')}
        variant="quiet"
        onPress={onReRecord}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  proposal: { gap: 8 },
  stack: { gap: 12 }
});
