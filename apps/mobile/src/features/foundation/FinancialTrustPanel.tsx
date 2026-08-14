/**
 * FinancialTrustPanel — proves User Story 3.
 *
 * Demonstrates source visibility, review routing, assistant confirmation,
 * correction actions, and actionable errors without raw provider details.
 * No uncertain or assistant-originated change can apply silently (UI Contract
 * §4, Constitution Principle I).
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { useTheme } from '@/state/theme-context';
import { translate } from '@/localization/i18n';
import { minTouchTarget } from '@/design-system/tokens';
import { buildFinancialChange } from '@/services/mocks/financial-changes';
import { applyFinancialChangeTransition } from '@/domain/financial-change';
import type {
  FinancialChange,
  FinancialChangeSource,
  FinancialChangeStatus
} from '@/domain/foundation';
import type { FinancialChangeScenario } from '@/services/contracts/foundation-service';

export interface FinancialTrustPanelProps {
  scenario: FinancialChangeScenario;
}

export function FinancialTrustPanel({ scenario }: FinancialTrustPanelProps) {
  const theme = useTheme();
  const [change, setChange] = useState(() => buildFinancialChange(scenario));
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setChange(buildFinancialChange(scenario));
    setFeedback(null);
  }, [scenario]);

  const transition = (status: FinancialChangeStatus) => {
    setChange((current) => applyFinancialChangeTransition(current, status));
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <StyledText variant="title">{translate('trust.title')}</StyledText>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }
        ]}
      >
        <Row
          label={translate('trust.source')}
          value={sourceDisplay(change.source)}
        />
        {change.sourceReference && shouldShowReference(change) && (
          <StyledText variant="caption">{change.sourceReference}</StyledText>
        )}

        <StatusLine
          scenario={scenario}
          status={change.status}
          onTransition={transition}
          onRetry={() => setFeedback(translate('trust.retrying'))}
        />

        <CorrectionActions
          change={change}
          scenario={scenario}
          onTransition={transition}
          onReport={() => setFeedback(translate('trust.reported'))}
        />
        {feedback && (
          <StyledText variant="body" accessibilityLiveRegion="polite">
            {feedback}
          </StyledText>
        )}
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <StyledText variant="body" accessibilityLabel={label}>
        {label}
      </StyledText>
      <StyledText variant="subtitle">{value}</StyledText>
    </View>
  );
}

function sourceDisplay(source: FinancialChangeSource): string {
  switch (source) {
    case 'automatic':
      return translate('trust.source.automatic');
    case 'voice':
      return translate('trust.source.voice');
    case 'manual':
      return translate('trust.source.manual');
    case 'assistant':
      return translate('trust.source.assistant');
    case 'platform_assisted':
      return translate('trust.source.platformAssisted');
  }
}

function shouldShowReference(change: { status: string }): boolean {
  return change.status !== 'rejected';
}

interface StatusLineProps {
  scenario: FinancialChangeScenario;
  status: FinancialChangeStatus;
  onTransition: (status: FinancialChangeStatus) => void;
  onRetry: () => void;
}

function StatusLine({
  scenario,
  status,
  onTransition,
  onRetry
}: StatusLineProps) {
  if (scenario === 'failed') {
    return (
      <View style={styles.block}>
        <StyledText
          variant="body"
          accessibilityLabel={translate('trust.errorTitle')}
        >
          {translate('trust.errorTitle')}
        </StyledText>
        <ActionButton
          label={translate('trust.errorAction')}
          onPress={onRetry}
        />
      </View>
    );
  }
  if (status === 'awaiting_confirmation') {
    return (
      <View style={styles.block}>
        <StyledText variant="body">{translate('trust.preview')}</StyledText>
        <ActionButton
          label={translate('trust.confirm')}
          onPress={() => onTransition('applied')}
          primary
        />
      </View>
    );
  }
  if (status === 'review_required') {
    return (
      <StyledText variant="body" accessibilityLabel={translate('trust.review')}>
        {translate('trust.review')}
      </StyledText>
    );
  }
  if (status === 'applied') {
    return <StyledText variant="body">{translate('trust.applied')}</StyledText>;
  }
  if (status === 'rejected') {
    return (
      <StyledText variant="body">{translate('trust.rejected')}</StyledText>
    );
  }
  if (status === 'undone') {
    return <StyledText variant="body">{translate('trust.undone')}</StyledText>;
  }
  if (status === 'corrected') {
    return (
      <StyledText variant="body">{translate('trust.corrected')}</StyledText>
    );
  }
  return null;
}

interface CorrectionActionsProps {
  change: FinancialChange;
  scenario: FinancialChangeScenario;
  onTransition: (status: FinancialChangeStatus) => void;
  onReport: () => void;
}

function CorrectionActions({
  change,
  scenario,
  onTransition,
  onReport
}: CorrectionActionsProps) {
  if (
    scenario === 'failed' ||
    change.status !== 'applied' ||
    change.correctionActions.size === 0
  ) {
    return null;
  }
  return (
    <View style={styles.actions}>
      {Array.from(change.correctionActions).map((action) => (
        <ActionButton
          key={action}
          label={translate(actionKey(action))}
          onPress={() => {
            if (action === 'undo') onTransition('undone');
            else if (action === 'edit') onTransition('corrected');
            else onReport();
          }}
        />
      ))}
    </View>
  );
}

function actionKey(action: 'undo' | 'edit' | 'report') {
  if (action === 'undo') return 'trust.undo' as const;
  if (action === 'edit') return 'trust.edit' as const;
  return 'trust.report' as const;
}

function ActionButton({
  label,
  onPress,
  primary
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.action,
        {
          backgroundColor: primary
            ? theme.colors.primary
            : theme.colors.surface,
          borderColor: theme.colors.border,
          minHeight: minTouchTarget
        }
      ]}
    >
      <Text
        style={{
          color: primary ? theme.colors.textInverse : theme.colors.textPrimary,
          fontSize: theme.typography.body.fontSize
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  block: { gap: 6, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  action: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  }
});
