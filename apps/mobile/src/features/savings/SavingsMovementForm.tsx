import React, { useRef, useState } from 'react';
import { View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { FormField } from '@/design-system/components/forms/FormField';
import { parseAmountToMinor } from '@/domain/core-finance';
import { normalizeLocalizedNumber } from '@/domain/localized-number';
import { localDateInTimeZone } from '@/domain/financial-period';
import {
  localDateFromTimestamp,
  parseLocalDate,
  type GoalMovement,
  type LocalDate
} from '@/domain/financial-planning';
import {
  PlanningScreen,
  PlanningState
} from '@/features/financial-planning/PlanningScaffold';
import { usePlanningFormDraft } from '@/features/financial-planning/usePlanningDraft';
import { TransactionDateField } from '@/features/transactions/TransactionDateField';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import type { GoalMovementPreview } from '@/services/contracts/financial-planning-service';
import { financialPlanningService } from '@/services/financial-planning-service';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { usePlanningMutation, useSavingsGoal } from './savings-queries';
import { useTheme } from '@/state/theme-context';
import {
  SavingsHeader,
  SavingsInfo,
  SavingsSegments,
  savingsDate,
  savingsStyles as styles
} from './SavingsVisuals';

type MovementKind = Extract<
  GoalMovement['kind'],
  'contribution' | 'withdrawal'
>;

export function SavingsMovementForm({ goalId = '' }: { goalId?: string }) {
  const goal = useSavingsGoal(goalId);
  const theme = useTheme();
  const timeZone = usePreferenceStore((s) => s.timeZone);
  const confirmLock = useRef(false);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const [kind, setKind] = useState<MovementKind>('contribution');
  const [amount, setAmount] = useState('');
  const [movementDate, setMovementDate] = useState(() =>
    localDateInTimeZone(Date.now(), timeZone)
  );
  const [preview, setPreview] = useState<GoalMovementPreview>();
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const movementKinds: MovementKind[] = ['contribution', 'withdrawal'];
  const confirm = usePlanningMutation((value: GoalMovementPreview) =>
    financialPlanningService.confirmGoalMovement(
      value.previewId,
      `goal-movement:${goalId}:${value.previewId}`
    )
  );
  const draftEnabled = Boolean(goal.data);
  const { draftReady, discardDraft } = usePlanningFormDraft({
    id: `planning-form-goal-movement:${goalId}`,
    kind: 'goal_movement',
    entityId: goalId || null,
    payload: { kind, amount, movementDate },
    meaningful: !saved && !confirm.isPending && Boolean(amount),
    enabled: draftEnabled,
    restore: (payload) => {
      const draft = payload as Partial<{
        kind: MovementKind;
        amount: string;
        movementDate: LocalDate;
      }>;
      if (draft.kind === 'contribution' || draft.kind === 'withdrawal')
        setKind(draft.kind);
      if (typeof draft.amount === 'string') setAmount(draft.amount);
      if (typeof draft.movementDate === 'string')
        setMovementDate(draft.movementDate);
    },
    onError: () => setError(translate('planning.state.error'))
  });

  const buildPreview = async () => {
    if (previewing) return;
    const amountMinor = parseAmountToMinor(
      normalizeLocalizedNumber(amount),
      goal.data?.goal.currencyCode ?? 'SAR'
    );
    if (
      !goal.data ||
      !amountMinor ||
      !/^\d{4}-\d{2}-\d{2}$/.test(movementDate)
    ) {
      setError(translate('planning.validation.required'));
      return;
    }
    try {
      parseLocalDate(movementDate);
    } catch {
      setError(translate('planning.validation.required'));
      return;
    }
    setPreviewing(true);
    setError(undefined);
    try {
      setPreview(
        await financialPlanningService.previewGoalMovement({
          goalId,
          kind,
          amountMinor,
          movementDate
        })
      );
    } catch {
      setError(translate('planning.state.error'));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <PlanningScreen
      titleKey="planning.savings.movement"
      hideHeader
      backgroundColor={theme.colors.surfaces.page}
    >
      <SavingsHeader
        title={translate('planning.savings.movement')}
        description={goal.data?.goal.title}
        label={translate('planning.savings.savedSoFar')}
        amount={
          hideBalances && !revealed
            ? translate('planning.state.hidden')
            : goal.data?.progress.currentMinor.status === 'available'
              ? formatMinorAmount(
                  goal.data.progress.currentMinor.value,
                  goal.data.goal.currencyCode,
                  currentLocale()
                )
              : translate('reports.state.unavailable')
        }
      />
      {!goalId ? (
        <PlanningState state="empty" />
      ) : goal.isLoading || (draftEnabled && !draftReady) ? (
        <PlanningState state="loading" />
      ) : goal.isError || !goal.data ? (
        <PlanningState state="error" onRetry={() => void goal.refetch()} />
      ) : preview ? (
        <>
          <SurfaceCard style={styles.card}>
            <View style={styles.detailsRow}>
              <StyledText>
                {translate('planning.savings.movementType')}
              </StyledText>
              <StyledText variant="subtitle">
                {translate(
                  `planning.savings.movement.${preview.kind}` as MessageKey
                )}
              </StyledText>
            </View>
            <StyledText>
              {translate('planning.savings.movementAmount')}
            </StyledText>
            <StyledText variant="amount" style={styles.money}>
              {hideBalances && !revealed
                ? translate('planning.state.hidden')
                : formatMinorAmount(
                    preview.amountMinor,
                    goal.data.goal.currencyCode,
                    currentLocale()
                  )}
            </StyledText>
            <StyledText>{savingsDate(movementDate)}</StyledText>
          </SurfaceCard>
          <SavingsInfo />
          <ActionButton
            label={translate('planning.savings.confirmMovement')}
            loading={confirm.isPending}
            disabled={saved}
            style={styles.button}
            onPress={() => {
              if (saved || confirm.isPending || confirmLock.current) return;
              confirmLock.current = true;
              confirm.mutate(preview, {
                onSuccess: () => {
                  setSaved(true);
                  void discardDraft().catch(() =>
                    setError(translate('planning.state.error'))
                  );
                },
                onError: () => {
                  confirmLock.current = false;
                  setError(translate('planning.state.error'));
                }
              });
            }}
          />
          <ActionButton
            label={translate('planning.action.edit')}
            onPress={() => {
              confirmLock.current = false;
              setPreview(undefined);
              setSaved(false);
            }}
            variant="quiet"
            disabled={confirm.isPending}
          />
          {saved ? (
            <StyledText accessibilityRole="alert">
              {translate('planning.state.saved')}
            </StyledText>
          ) : null}
          {error ? (
            <StyledText accessibilityRole="alert">{error}</StyledText>
          ) : null}
        </>
      ) : (
        <>
          <SavingsSegments
            value={kind}
            disabled={previewing}
            onChange={setKind}
            options={movementKinds.map((value) => ({
              value,
              label: translate(
                `planning.savings.movement.${value}` as MessageKey
              )
            }))}
          />
          <SurfaceCard style={styles.card}>
            <FormField
              label={translate('planning.savings.movementAmount')}
              onChangeText={setAmount}
              value={amount}
              variant="amount"
              helperText={goal.data.goal.currencyCode}
              editable={!previewing}
            />
            <TransactionDateField
              label={translate('planning.savings.movementDate')}
              value={Date.parse(`${movementDate}T12:00:00`)}
              disabled={previewing}
              onChange={(timestamp) =>
                setMovementDate(localDateFromTimestamp(timestamp))
              }
            />
          </SurfaceCard>
          {error ? (
            <StyledText accessibilityRole="alert">{error}</StyledText>
          ) : null}
          <SavingsInfo />
          <ActionButton
            label={translate('planning.savings.previewMovement')}
            loading={previewing}
            onPress={() => void buildPreview()}
            style={styles.button}
          />
        </>
      )}
    </PlanningScreen>
  );
}
