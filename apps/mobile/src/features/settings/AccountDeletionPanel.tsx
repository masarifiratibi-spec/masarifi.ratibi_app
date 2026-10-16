import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { randomUUID } from 'expo-crypto';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import type { PrivacyRequest } from '@/domain/settings';
import { authService } from '@/features/auth/auth-flow';
import { signOutAppShellSession } from '@/features/auth/session-controller';
import { translateDynamic as t } from '@/localization/i18n';
import { HttpError } from '@/services/live/http-client';
import { settingsService } from '@/services/mocks/subscription-settings-service';
import { useAppShellStore } from '@/state/app-shell';
import {
  loadAccountDeletionJournal,
  removeAccountDeletionOperationId,
  saveAccountDeletionOperationId,
  saveAccountDeletionRequestId
} from '@/services/account-deletion-journal';
import { startAccountDeletionVerification } from './account-deletion-auth';
import { isDevPrivacyDeletionEnabled } from '@/config/client-runtime';
import { DevAccountDeletionPanel } from './DevAccountDeletionPanel';

export function AccountDeletionPanel() {
  const session = useAppShellStore((state) => state.session);
  const ownerId = session?.status === 'authenticated' ? session.userId : null;
  if (ownerId && isDevPrivacyDeletionEnabled())
    return <DevAccountDeletionPanel key={ownerId} ownerId={ownerId} />;
  return ownerId ? (
    <OwnedAccountDeletionPanel key={ownerId} ownerId={ownerId} />
  ) : null;
}

function OwnedAccountDeletionPanel({ ownerId }: { ownerId: string }) {
  const [request, setRequest] = React.useState<PrivacyRequest | null>(null);
  const [pending, setPending] = React.useState(true);
  const [restored, setRestored] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [recentAuth, setRecentAuth] = React.useState(false);
  const [verification, setVerification] = React.useState<Awaited<
    ReturnType<typeof startAccountDeletionVerification>
  > | null>(null);
  const [code, setCode] = React.useState('');
  const operation = React.useRef<string | null>(null);
  const active = React.useRef(true);
  const current = () =>
    active.current &&
    useAppShellStore.getState().session?.status === 'authenticated' &&
    useAppShellStore.getState().session?.userId === ownerId;

  function showError(failure: unknown) {
    if (!current()) return;
    if (failure instanceof HttpError && failure.code === 'rate_limited') {
      setError('settings.deletion.rateLimited');
      return;
    }
    const requiresRecent =
      failure instanceof HttpError &&
      failure.domainCode === 'RECENT_AUTH_REQUIRED';
    if (requiresRecent) setRecentAuth(true);
    setError(
      requiresRecent
        ? null
        : failure instanceof HttpError &&
            failure.domainCode === 'DELETION_VERIFICATION_UNAVAILABLE'
          ? 'settings.deletion.verificationUnavailable'
          : failure instanceof HttpError && failure.code === 'session_expired'
            ? 'settings.deletion.sessionExpired'
            : 'settings.deletion.error'
    );
  }

  async function completeSignOut() {
    if (!current()) return;
    await signOutAppShellSession(authService, 'local');
  }

  async function accept(next: PrivacyRequest) {
    if (!current()) return;
    // Persist the server identifier before exposing a request that must survive reopening.
    await saveAccountDeletionRequestId(ownerId, next.id);
    if (!current()) return;
    if (next.serverStatus === 'failed' || next.serverStatus === 'cancelled') {
      await removeAccountDeletionOperationId(ownerId);
      operation.current = null;
    }
    if (!current()) return;
    setRequest(next);
    setRecentAuth(false);
    setVerification(null);
    setCode('');
    if (next.serverStatus === 'completed') await completeSignOut();
  }

  async function restoreRequest() {
    const { requestId: savedId, operationId: savedOperation } =
      await loadAccountDeletionJournal(ownerId);
    if (!current()) return;
    operation.current = savedOperation;
    if (savedId)
      await accept(await settingsService.getAccountDeletion(savedId));
    if (current()) setRestored(true);
  }

  React.useEffect(() => {
    active.current = true;
    void (async () => {
      try {
        await restoreRequest();
      } catch (failure) {
        showError(failure);
      } finally {
        if (current()) setPending(false);
      }
    })();
    return () => {
      active.current = false;
    };
    // The owner key remounts this component when the authenticated owner changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  async function run(action: () => Promise<void>) {
    if (pending || !current()) return;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      showError(failure);
    } finally {
      if (current()) setPending(false);
    }
  }

  async function submit() {
    operation.current ??= randomUUID();
    await saveAccountDeletionOperationId(ownerId, operation.current);
    if (!current()) return;
    const result = await settingsService.requestPrivacyAction(
      'account_deletion',
      operation.current
    );
    await accept(result.value);
  }

  function confirm(action: () => Promise<void>, cancelling = false) {
    Alert.alert(
      t(
        cancelling
          ? 'settings.deletion.cancel'
          : 'appShell.security.deleteAccount'
      ),
      t(
        cancelling
          ? 'settings.deletion.cancelConfirmation'
          : 'appShell.security.deleteAccount.confirmation'
      ),
      [
        { text: t('coreFinance.cancel'), style: 'cancel' },
        {
          text: t('settings.privacy.confirmRequest'),
          style: 'destructive',
          onPress: () => void run(action)
        }
      ]
    );
  }

  const status = request?.serverStatus;
  const canRequest =
    restored && (!request || status === 'cancelled' || status === 'failed');
  const canCancel =
    (status === 'requested' || status === 'verified') &&
    request?.coolingOffEndsAt !== undefined &&
    Date.now() < request.coolingOffEndsAt;

  return (
    <View style={styles.stack}>
      <StyledText>appShell.security.deleteAccount.description</StyledText>
      <StyledText>settings.deletion.retentionNotice</StyledText>
      {pending ? (
        <StyledText accessibilityLiveRegion="polite">
          settings.deletion.pending
        </StyledText>
      ) : null}
      {status ? (
        <StyledText accessibilityLiveRegion="polite">{`settings.deletion.status.${status}`}</StyledText>
      ) : null}
      {request?.coolingOffEndsAt !== undefined &&
      ['requested', 'verified'].includes(status ?? '') ? (
        <StyledText>
          {t('settings.deletion.deadline', {
            date: new Date(request.coolingOffEndsAt).toLocaleString()
          })}
        </StyledText>
      ) : null}
      {request?.retainedCategories?.length ? (
        <StyledText>
          {t('settings.deletion.retained', {
            categories: request.retainedCategories.join(', ')
          })}
        </StyledText>
      ) : null}
      {error ? (
        <StyledText accessibilityRole="alert">{error}</StyledText>
      ) : null}
      {error === 'settings.deletion.verificationUnavailable' ? (
        <ActionButton
          label="appShell.auth.signOut"
          loading={pending}
          onPress={() => void run(completeSignOut)}
        />
      ) : null}
      {recentAuth ? (
        <>
          <StyledText accessibilityRole="alert">
            settings.deletion.recentAuth
          </StyledText>
          <ActionButton
            label="settings.deletion.reverify"
            loading={pending}
            onPress={() =>
              void run(async () => {
                const next = await startAccountDeletionVerification(ownerId);
                if (current()) setVerification(next);
              })
            }
          />
        </>
      ) : null}
      {verification ? (
        <>
          <StyledText>
            {t('settings.deletion.codeSent', {
              destination: verification.safeIdentifier
            })}
          </StyledText>
          <FormField
            label="settings.deletion.code"
            variant="otp"
            value={code}
            onChangeText={setCode}
            autoComplete="one-time-code"
          />
          <ActionButton
            label="settings.deletion.verify"
            disabled={!code.trim()}
            loading={pending}
            onPress={() =>
              void run(async () => {
                try {
                  await verification.verify(code.trim());
                } catch (failure) {
                  if (
                    failure instanceof HttpError &&
                    failure.code === 'session_expired'
                  )
                    throw failure;
                  if (current())
                    setError('settings.deletion.verificationError');
                  return;
                }
                if (!current()) return;
                setVerification(null);
                setRecentAuth(false);
                if (current()) await submit();
              })
            }
          />
        </>
      ) : null}
      {canRequest && !recentAuth ? (
        <ActionButton
          label="appShell.security.deleteAccount"
          variant="destructive"
          loading={pending}
          onPress={() => confirm(submit)}
        />
      ) : null}
      {!restored || (request && status !== 'completed') ? (
        <ActionButton
          label="settings.deletion.refresh"
          variant="secondary"
          loading={pending}
          onPress={() =>
            void run(async () => {
              if (!restored) await restoreRequest();
              else if (request)
                await accept(
                  await settingsService.getAccountDeletion(request.id)
                );
            })
          }
        />
      ) : null}
      {canCancel ? (
        <ActionButton
          label="settings.deletion.cancel"
          variant="secondary"
          loading={pending}
          onPress={() =>
            confirm(async () => {
              await settingsService.cancelAccountDeletion(
                request.id,
                randomUUID()
              );
              if (!current()) return;
              await removeAccountDeletionOperationId(ownerId);
              operation.current = null;
              setRequest({
                ...request,
                serverStatus: 'cancelled',
                status: 'cancelled'
              });
            }, true)
          }
        />
      ) : null}
      {status === 'completed' ? (
        <ActionButton
          label="appShell.auth.signOut"
          loading={pending}
          onPress={() => void run(completeSignOut)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: 12 } });
