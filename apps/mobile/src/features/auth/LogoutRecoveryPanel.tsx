import React, { useRef, useState } from 'react';
import { StateView } from '@/design-system/components/feedback/StateView';
import { translate } from '@/localization/i18n';
import { retryPendingLogout } from '@/services/owner-lifecycle';
import { HttpError } from '@/services/live/http-client';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';

export function LogoutRecoveryPanel() {
  const ownerId = useAppShellStore(state => state.logoutRecoveryOwnerId);
  const locale = usePreferenceStore(state => state.locale);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef(false);
  if (!ownerId) return null;
  const retry = async () => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    try {
      await retryPendingLogout(ownerId);
      if (useAppShellStore.getState().logoutRecoveryOwnerId === null && !useAppShellStore.getState().session?.userId)
        useAppShellStore.getState().retryBootstrap();
    } catch (error) {
      if (useAppShellStore.getState().logoutRecoveryOwnerId !== ownerId) return;
      setBlocked(error instanceof HttpError && ['LOGOUT_SESSION_UNVERIFIED', 'LOGOUT_RETRY_UNAVAILABLE', 'LOGOUT_OWNER_CHANGED'].includes(error.domainCode ?? ''));
      setFailed(true);
    } finally { active.current = false; setBusy(false); }
  };
  return <StateView state={failed ? 'error' : 'pending-sync'}
    title={translate('logout.pendingTitle', locale)}
    message={translate(blocked ? 'logout.originalSessionUnavailable' : failed ? 'logout.retryFailed' : 'logout.pendingBody', locale)}
    actionLabel={translate(busy ? 'logout.retrying' : 'logout.retry', locale)}
    onAction={busy ? undefined : () => { void retry(); }} />;
}
