import React, { useLayoutEffect, useRef, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { ConfirmationDialog } from '@/design-system/components/overlays/ConfirmationDialog';
import { FinancialPlanningError } from '@/domain/financial-planning';
import { translate, translateDynamic } from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { useAppShellStore } from '@/state/app-shell';
import { usePlanningMutation } from './financial-planning-queries';

type Target = { kind: 'salary' | 'obligation'; id: string; version: number; name: string; onArchived?: () => void };

export function PlanningArchiveAction(target: Target) {
  const session = useAppShellStore((state) => state.session);
  if (session?.status !== 'authenticated' || !session.userId) return null;
  return <OwnedArchiveAction key={JSON.stringify([session.userId, target.id, target.version])}
    {...target} owner={session.userId} />;
}

function OwnedArchiveAction({ kind, id, version, name, owner, onArchived }: Target & { owner: string }) {
  const [confirming, setConfirming] = useState(false);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const mutation = usePlanningMutation<void, string>(async () => {
    const session = useAppShellStore.getState().session;
    if (session?.status !== 'authenticated' || session.userId !== owner)
      throw new FinancialPlanningError('not_found');
    if (!onlineManager.isOnline()) throw new FinancialPlanningError('offline_unavailable');
    const key = `archive:${kind}:${id}:${version}`;
    const result = kind === 'salary'
      ? await financialPlanningService.archiveSalaryProfile(id, version, key)
      : await financialPlanningService.setObligationStatus(id, version, 'archived', key);
    if (mounted.current && useAppShellStore.getState().session?.userId === owner) onArchived?.();
    return { value: id, affectedScopes: result.affectedScopes };
  }, { networkMode: 'always', retry: false });
  const label = translate(`planning.${kind}.archive`);
  return (
    <>
      <ActionButton label={label} variant="destructive" loading={mutation.isPending}
        onPress={() => setConfirming(true)} />
      <ConfirmationDialog visible={confirming} title={label} confirmLabel={label}
        message={translateDynamic(`planning.${kind}.archiveConfirm`, { name })}
        destructive onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); mutation.mutate(); }} />
      {mutation.isError && <StyledText accessibilityRole="alert">{translate('planning.archiveFailed')}</StyledText>}
    </>
  );
}
