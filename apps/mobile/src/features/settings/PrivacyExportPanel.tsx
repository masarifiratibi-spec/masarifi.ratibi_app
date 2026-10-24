import React, { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { createPrivacyExportSession } from '@/services/privacy-export-session';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import type { PrivacyExportStatus } from '@/domain/settings';
import { settingsService } from '@/services/mocks/subscription-settings-service';
import { useAppShellStore } from '@/state/app-shell';

export function PrivacyExportPanel() {
  const owner = useAppShellStore((state) => state.session?.userId);
  return owner ? <OwnedExportPanel key={owner} owner={owner} /> : null;
}

function OwnedExportPanel({ owner }: { owner: string }) {
  const session = useRef(createPrivacyExportSession(owner));
  const [value, setValue] = useState<PrivacyExportStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const active = useRef(true);
  const current = () =>
    active.current && useAppShellStore.getState().session?.userId === owner;
  const assertCurrent = () => {
    if (!current()) throw new Error('OWNER_CHANGED');
  };
  const refresh = async (id: string) => {
    const next = await settingsService.getPrivacyExport(id);
    assertCurrent();
    if (next.id !== id) throw new Error('EXPORT_ID_MISMATCH');
    setValue(next);
    return next;
  };
  useEffect(() => {
    active.current = true;
    void (async () => {
      try {
        const requestId = await session.current.restore();
        assertCurrent();
        if (requestId) await refresh(requestId);
      } catch {
        if (current()) setFailed(true);
      } finally {
        if (current()) setBusy(false);
      }
    })();
    return () => {
      active.current = false;
    };
    // Owner-keyed component remounts rather than sharing an export between owners.
  }, [owner]);

  const perform = async (download = false, newRequest = false) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      assertCurrent();
      const requestId = await session.current.request(
        settingsService,
        assertCurrent,
        newRequest
      );
      const next = await refresh(requestId);
      if (download) {
        if (
          next.status !== 'ready' ||
          !next.downloadUrl ||
          !next.downloadUrlExpiresAt ||
          Date.parse(next.downloadUrlExpiresAt) <= Date.now()
        )
          throw new Error('EXPORT_NOT_READY');
        assertCurrent();
        await Linking.openURL(next.downloadUrl);
      }
    } catch {
      if (current()) setFailed(true);
    } finally {
      if (current()) setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <StyledText>settings.privacy.exportExplanation</StyledText>
      {value ? (
        <StyledText accessibilityRole="alert">{`settings.privacy.exportState.${value.status}`}</StyledText>
      ) : null}
      {failed ? (
        <StyledText accessibilityRole="alert">
          settings.privacy.exportFailure
        </StyledText>
      ) : null}
      <ActionButton
        label={
          value
            ? 'settings.privacy.exportRefresh'
            : 'settings.privacy.exportRequest'
        }
        loading={busy}
        onPress={() => void perform()}
      />
      {value?.status === 'ready' ? (
        <ActionButton
          label="settings.privacy.exportDownload"
          loading={busy}
          onPress={() => void perform(true)}
        />
      ) : null}
      {value && ['expired', 'failed'].includes(value.status) ? (
        <ActionButton
          label="settings.privacy.exportNew"
          loading={busy}
          onPress={() => void perform(false, true)}
        />
      ) : null}
    </View>
  );
}
