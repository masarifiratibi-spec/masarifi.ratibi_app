import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import type { Account, Category } from '@/domain/core-finance';
import type { VoiceProposalGroup, VoiceTransactionProposal } from '@/domain/voice-capture';
import { translate } from '@/localization/i18n';
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
  return (
    <View style={styles.stack}>
      {visible.map((proposal) => (
        <VoiceReview
          key={proposal.id}
          proposal={proposal}
          accounts={accounts}
          categories={categories}
          onChange={(value) => onChange(proposal.id, value)}
          onConfirmField={(field) => onConfirmField(proposal.id, field)}
          onRemove={() => onRemove(proposal.id)}
        />
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

const styles = StyleSheet.create({ stack: { gap: 12 } });
