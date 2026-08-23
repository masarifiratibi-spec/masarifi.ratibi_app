import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { ChipSelector } from '@/design-system/components/forms/ChipControls';
import { FormField } from '@/design-system/components/forms/FormField';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
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

export function VoiceCaptureScreen({ autoStart = false }: { autoStart?: boolean }) {
  const voice = useVoiceCapture();
  const autoStartAttempted = useRef(false);
  const homeNavigationStarted = useRef(false);
  const [scenarioPicker, setScenarioPicker] = useState(false);
  const accounts = useAccounts();
  const categories = useCategories();
  const { session } = voice;
  const errorKey = session.errorCode
    ? (`voice.error.${session.errorCode}` as const)
    : 'voice.error.unknown';

  useEffect(() => {
    if (
      autoStart &&
      session.state === 'ready' &&
      session.permission === 'granted' &&
      !autoStartAttempted.current
    ) {
      autoStartAttempted.current = true;
      void voice.start();
    }
  }, [autoStart, session.permission, session.state, voice]);

  useEffect(() => {
    if (session.state !== 'saved' || homeNavigationStarted.current) return;
    homeNavigationStarted.current = true;
    router.replace('/(tabs)/home');
  }, [session.state]);

  const processing = ['stopping', 'transcribing', 'analyzing', 'saving'].includes(
    session.state
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <StyledText variant="title">{translate('voice.title')}</StyledText>
      {__DEV__ && !autoStart ? <StyledText>{translate('voice.demoNotice')}</StyledText> : null}

      {__DEV__ && !autoStart ? (
        <>
          <PickerField
            label={translate('voice.scenario.title')}
            value={translate(`voice.scenario.${session.scenario}` as never)}
            disabled={!['ready', 'permission_required', 'failed'].includes(session.state)}
            onPress={() => setScenarioPicker(true)}
          />
          <AppSheet
            title={translate('voice.scenario.title')}
            visible={scenarioPicker}
            onDismiss={() => setScenarioPicker(false)}
          >
            <ChipSelector
              options={demoScenarios.map((scenario) =>
                translate(`voice.scenario.${scenario}` as never)
              )}
              selected={[
                translate(`voice.scenario.${session.scenario}` as never)
              ]}
              onToggle={(label) => {
                const index = demoScenarios.findIndex(
                  (scenario) =>
                    translate(`voice.scenario.${scenario}` as never) === label
                );
                if (index >= 0) voice.setScenario(demoScenarios[index]);
                setScenarioPicker(false);
              }}
            />
          </AppSheet>
        </>
      ) : null}

      {session.state === 'permission_required' ? (
        session.permission === 'permanently_denied' ? (
          <View style={styles.stack}>
            <StateView
              state="error"
              title={translate('voice.error.permission_permanent')}
            />
            <ActionButton
              label={translate('voice.permission.settings')}
              variant="secondary"
              onPress={() => void voice.openSettings()}
            />
          </View>
        ) : session.permission === 'unavailable' ? (
          <StateView
            state="error"
            title={translate('voice.permission.unavailable')}
          />
        ) : (
          <View style={styles.stack}>
            <StyledText variant="subtitle">{translate('voice.permission.title')}</StyledText>
            <StyledText>{translate('voice.permission.body')}</StyledText>
            <ActionButton
              label={translate('voice.permission.request')}
              onPress={() => void voice.requestPermission()}
            />
          </View>
        )
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

      {session.state === 'permission_required' || session.state === 'failed' ? (
        <ActionButton
          label={translate('voice.action.manual')}
          variant="quiet"
          onPress={() => {
            void voice.cancel();
            router.replace('/(tabs)/add');
          }}
        />
      ) : null}
      </ScrollView>
      {processing ? (
        <View
          accessibilityLabel={translate(
            session.state === 'saving'
              ? 'voice.state.saving'
              : 'voice.state.processing'
          )}
          accessibilityLiveRegion="polite"
          testID="voice-processing-overlay"
          style={styles.processingOverlay}
        >
          <SurfaceCard style={styles.processingCard}>
            <StateView
              state="loading"
              title={translate(
                session.state === 'saving'
                  ? 'voice.state.saving'
                  : 'voice.state.processing'
              )}
            />
          </SurfaceCard>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: { gap: 14, padding: 16, paddingBottom: 40 },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'center',
    padding: 24
  },
  processingCard: { maxWidth: 320, width: '100%' }
});
