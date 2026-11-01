import React, { useEffect, useRef, useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { createPrivacyExportSession } from '@/services/privacy-export-session';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import type { PrivacyExportStatus } from '@/domain/settings';
import { settingsService } from '@/services/mocks/subscription-settings-service';
import { useAppShellStore } from '@/state/app-shell';

export function PrivacyExportPanel() {
  const owner = useAppShellStore((state) => state.session?.userId);
  return owner ? (
    <OwnedExportPanel key={owner} owner={owner} />
  ) : (
    <StyledText>reports.export.signIn</StyledText>
  );
}

function OwnedExportPanel({ owner }: { owner: string }) {
  const session = useRef(createPrivacyExportSession(owner));
  const [value, setValue] = useState<PrivacyExportStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState<'download' | 'share' | null>(null);
  const inFlight = useRef(true);
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
        if (current()) {
          inFlight.current = false;
          setBusy(false);
        }
      }
    })();
    return () => {
      active.current = false;
    };
    // Owner-keyed component remounts rather than sharing an export between owners.
  }, [owner]);

  const perform = async (output?: 'download' | 'share', newRequest = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    setOpened(null);
    try {
      assertCurrent();
      const requestId = await session.current.request(
        settingsService,
        assertCurrent,
        newRequest
      );
      const next = await refresh(requestId);
      if (output) {
        if (
          next.status !== 'ready' ||
          !next.downloadUrl ||
          !next.downloadUrlExpiresAt ||
          !Number.isFinite(Date.parse(next.downloadUrlExpiresAt)) ||
          Date.parse(next.downloadUrlExpiresAt) <= Date.now() ||
          new URL(next.downloadUrl).protocol !== 'https:'
        )
          throw new Error('EXPORT_NOT_READY');
        assertCurrent();
        if (output === 'share')
          await Share.share({
            message: next.downloadUrl,
            url: next.downloadUrl
          });
        else await Linking.openURL(next.downloadUrl);
        assertCurrent();
        setOpened(output);
      }
    } catch {
      if (current()) setFailed(true);
    } finally {
      if (current()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <StyledText>settings.privacy.exportExplanation</StyledText>
      <StyledText variant="caption">reports.export.format</StyledText>
      {busy ? (
        <StyledText accessibilityLiveRegion="polite">
          reports.export.loading
        </StyledText>
      ) : !value && !failed ? (
        <StyledText>reports.export.empty</StyledText>
      ) : null}
      {value ? (
        <StyledText accessibilityRole="alert">{`settings.privacy.exportState.${value.status}`}</StyledText>
      ) : null}
      {failed ? (
        <StyledText accessibilityRole="alert">
          settings.privacy.exportFailure
        </StyledText>
      ) : null}
      {opened ? (
        <StyledText accessibilityLiveRegion="polite">{`reports.export.opened.${opened}`}</StyledText>
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
        <>
          <ActionButton
            label="settings.privacy.exportDownload"
            loading={busy}
            onPress={() => void perform('download')}
          />
          <ActionButton
            label="reports.export.share"
            variant="secondary"
            loading={busy}
            onPress={() => void perform('share')}
          />
          <StyledText variant="caption">reports.export.sharePrivacy</StyledText>
        </>
      ) : null}
      {value && ['expired', 'failed'].includes(value.status) ? (
        <ActionButton
          label="settings.privacy.exportNew"
          loading={busy}
          onPress={() => void perform(undefined, true)}
        />
      ) : null}
    </View>
  );
}
