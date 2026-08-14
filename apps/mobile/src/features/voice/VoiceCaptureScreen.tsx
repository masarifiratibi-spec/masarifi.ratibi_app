import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { RadioCard } from '@/design-system/components/forms/SelectionControls';
import { FormField } from '@/design-system/components/forms/FormField';
import type { VoiceScenario } from '@/domain/voice-capture';
import { useAccounts, useCategories } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { VoiceRecorder } from './VoiceRecorder';
import { VoiceReviewGroup } from './VoiceReviewGroup';
import { useVoiceCapture } from './useVoiceCapture';

const demoScenarios: readonly VoiceScenario[] = [
  'clear_ar',
  'clear_en',
  'multiple',
  'missing_account',
  'low_confidence',
  'obligation',
  'failed_analysis',
  'no_speech',
  'background_noise',
  'offline'
];

export function VoiceCaptureScreen({ onManual }: { onManual(): void }) {
  const voice = useVoiceCapture();
  const accounts = useAccounts();
  const categories = useCategories();
  const { session } = voice;
  const errorKey = session.errorCode
    ? (`voice.error.${session.errorCode}` as const)
    : 'voice.error.unknown';

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <StyledText variant="title">{translate('voice.title')}</StyledText>
      <StyledText>{translate('voice.demoNotice')}</StyledText>

      <StyledText variant="subtitle">{translate('voice.scenario.title')}</StyledText>
      <View style={styles.options}>
        {demoScenarios.map((scenario) => (
          <RadioCard
            key={scenario}
            label={translate(`voice.scenario.${scenario}` as never)}
            selected={session.scenario === scenario}
            disabled={!['ready', 'permission_required', 'failed'].includes(session.state)}
            onPress={() => voice.setScenario(scenario)}
          />
        ))}
      </View>

      {session.state === 'permission_required' ? (
        <View style={styles.stack}>
          <StyledText variant="subtitle">{translate('voice.permission.title')}</StyledText>
          <StyledText>{translate('voice.permission.body')}</StyledText>
          <ActionButton
            label={translate('voice.permission.request')}
            onPress={() => void voice.requestPermission()}
          />
        </View>
      ) : null}

      {session.state === 'ready' || session.state === 'recording' ? (
        <VoiceRecorder
          state={session.state}
          durationMs={session.durationMs}
          onStart={() => void voice.start()}
          onStop={() => void voice.stop()}
          onCancel={() => void voice.cancelRecording()}
        />
      ) : null}

      {['stopping', 'transcribing', 'analyzing', 'saving'].includes(session.state) ? (
        <StateView
          state="loading"
          title={translate(
            session.state === 'saving' ? 'voice.state.saving' : 'voice.state.processing'
          )}
        />
      ) : null}

      {session.state === 'transcript_review' && session.transcript ? (
        <View style={styles.stack}>
          <StyledText variant="subtitle">{translate('voice.transcript.title')}</StyledText>
          <FormField
            label={translate('voice.transcript.edit')}
            value={session.transcript.text}
            multiline
            onChangeText={voice.editTranscript}
          />
          <ActionButton
            label={translate('voice.transcript.analyze')}
            onPress={() => void voice.analyze()}
          />
          <ActionButton
            label={translate('voice.record.rerecord')}
            variant="secondary"
            onPress={() => void voice.reRecord()}
          />
        </View>
      ) : null}

      {session.group &&
      (session.state === 'proposal_review' || session.errorCode === 'save_failed') ? (
        <View style={styles.stack}>
          <StyledText variant="subtitle">{translate('voice.review.title')}</StyledText>
          {session.errorCode ? (
            <StateView state="error" title={translate(errorKey as never)} />
          ) : null}
          <VoiceReviewGroup
            group={session.group}
            accounts={accounts.data ?? []}
            categories={categories.data ?? []}
            onChange={voice.updateProposal}
            onConfirmField={voice.confirmField}
            onRemove={voice.removeProposal}
            onSave={() => void voice.save()}
            onSaveAll={() => void voice.save(true)}
            onReRecord={() => void voice.reRecord()}
          />
        </View>
      ) : null}

      {session.state === 'saved' ? (
        <StateView
          state="success"
          title={translate('voice.state.saved')}
          actionLabel={translate('voice.record.rerecord')}
          onAction={() => void voice.reRecord()}
        />
      ) : null}

      {session.state === 'failed' && session.errorCode !== 'save_failed' ? (
        <View style={styles.stack}>
          <StateView
            state={session.errorCode === 'offline' ? 'offline' : 'error'}
            title={translate(errorKey as never)}
            actionLabel={translate('voice.action.retry')}
            onAction={() => void voice.reRecord()}
          />
          {session.errorCode === 'permission_permanent' ? (
            <ActionButton
              label={translate('voice.permission.settings')}
              variant="secondary"
              onPress={() => void voice.openSettings()}
            />
          ) : null}
        </View>
      ) : null}

      <ActionButton
        label={translate('voice.action.manual')}
        variant="quiet"
        onPress={() => {
          void voice.cancel();
          onManual();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, padding: 16, paddingBottom: 40 },
  options: { gap: 8 }
});
