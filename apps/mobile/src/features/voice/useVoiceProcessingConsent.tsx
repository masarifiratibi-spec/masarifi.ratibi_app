import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { beginVoiceUpdateInteraction } from '@/state/voice-update-interaction';

// This acknowledgement contains no audio or financial data. A new disclosure
// version requires a new affirmative choice for this owner on this device.
const disclosureVersion = 'voice-processing-v1';
const consentKey = (owner: string) =>
  `masarifi.voice.processing-consent.${bytesToHex(sha256(utf8ToBytes(owner)))}`;
// A storage failure must not reactivate a withdrawal in this running app.
const withdrawn = new Set<string>();

type Request = {
  session: ReturnType<typeof useAppShellStore.getState>['session'];
  key: string;
  resolve: (accepted: boolean) => void;
  finishInteraction: () => void;
};

export function useVoiceProcessingConsent() {
  const [view, setView] = useState<{ granted: boolean; busy: boolean; failed: boolean } | null>(null);
  const request = useRef<Request | null>(null);
  const mounted = useRef(true);
  const isCurrent = (value: Request) => mounted.current &&
    request.current === value && value.session === useAppShellStore.getState().session &&
    value.session?.status === 'authenticated' &&
    useAppShellStore.getState().privacyLock?.appLockStatus !== 'locked';
  const close = (accepted = false) => {
    const value = request.current;
    request.current = null;
    if (mounted.current) setView(null);
    value?.finishInteraction();
    value?.resolve(accepted);
  };

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = useAppShellStore.subscribe((next, previous) => {
      if (next.session !== previous.session || next.privacyLock?.appLockStatus === 'locked') close();
    });
    return () => {
      mounted.current = false;
      close();
      unsubscribe();
    };
  }, []);

  const ensure = (review = false): Promise<boolean> => {
    if (request.current) return Promise.resolve(false);
    const session = useAppShellStore.getState().session;
    const ownerId = session?.userId;
    if (session?.status !== 'authenticated' || !ownerId ||
      useAppShellStore.getState().privacyLock?.appLockStatus === 'locked') return Promise.resolve(false);
    return new Promise(resolve => {
      const value: Request = { session, key: consentKey(ownerId), resolve, finishInteraction: beginVoiceUpdateInteraction() };
      request.current = value;
      void AsyncStorage.getItem(value.key).then(stored => {
        if (!isCurrent(value)) return;
        const granted = stored === disclosureVersion && !withdrawn.has(value.key);
        if (granted && !review) close(true);
        else setView({ granted, busy: false, failed: false });
      }).catch(() => {
        if (isCurrent(value)) setView({ granted: false, busy: false, failed: true });
      });
    });
  };

  const save = async (granted: boolean, onWithdraw: () => Promise<void>) => {
    const value = request.current;
    if (!value || !isCurrent(value) || view?.busy) return;
    setView(previous => previous && { ...previous, busy: true, failed: false });
    try {
      if (!granted) {
        withdrawn.add(value.key);
        await onWithdraw();
        if (!isCurrent(value)) return;
      }
      // Persist before any microphone access. A failed write keeps the modal
      // open, so recording cannot continue on an unrecorded acknowledgement.
      await AsyncStorage.setItem(value.key, granted ? disclosureVersion : 'withdrawn');
      if (!isCurrent(value)) return;
      if (granted) withdrawn.delete(value.key);
      if (isCurrent(value)) close(granted);
    } catch {
      if (isCurrent(value)) setView(previous => previous && { ...previous, busy: false, failed: true });
    }
  };

  return {
    ensure: () => ensure(),
    review: () => { void ensure(true); },
    render: (onWithdraw: () => Promise<void>) => view ? (
      <AppSheet title={translate('voice.processingConsent.title')} visible
        onDismiss={() => { if (!view.busy) close(); }}>
        <ScrollView contentContainerStyle={styles.content}>
          <StyledText>{translate('voice.processingConsent.data')}</StyledText>
          <StyledText>{translate('voice.processingConsent.purpose')}</StyledText>
          <StyledText>{translate('voice.processingConsent.choice')}</StyledText>
          {view.failed ? <StyledText accessibilityRole="alert">voice.processingConsent.error</StyledText> : null}
          <ActionButton label={view.granted ? 'voice.processingConsent.withdraw' : 'voice.processingConsent.accept'}
            loading={view.busy} onPress={() => void save(!view.granted, onWithdraw)} />
          <ActionButton label="voice.processingConsent.decline" variant="secondary" disabled={view.busy}
            onPress={() => {
              close();
              router.replace('/(tabs)/add');
            }} />
        </ScrollView>
      </AppSheet>
    ) : null
  };
}

const styles = StyleSheet.create({ content: { gap: 16, paddingBottom: 16 } });
