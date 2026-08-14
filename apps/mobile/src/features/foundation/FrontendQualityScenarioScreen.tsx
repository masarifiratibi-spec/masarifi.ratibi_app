import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton, SurfaceCard } from '@/design-system';
import { minTouchTarget } from '@/design-system/tokens';
import { translate, translateDynamic } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';
import {
  frontendQualityScenarios,
  type FrontendQualityScenarioId
} from '@/test-utils/frontend-quality-scenarios';
import { resetFrontendQualityScenario } from '@/test-utils/frontend-quality-scenario-reset';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; routes: readonly string[]; scenarioId: FrontendQualityScenarioId }
  | { code: string; kind: 'failure' };

type Props = {
  defaultProfileId?: string;
};

export function FrontendQualityScenarioScreen({
  defaultProfileId = 'spec010-disposable'
}: Props) {
  const theme = useTheme();
  const [selected, setSelected] = useState<FrontendQualityScenarioId>('typical');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function resetSelected() {
    if (!confirmed) return;
    setStatus({ kind: 'loading' });
    try {
      const result = await resetFrontendQualityScenario({
        profileId: defaultProfileId,
        scenarioId: selected
      });
      setStatus({
        kind: 'success',
        routes: result.seeded.expectedRoutes,
        scenarioId: result.scenarioId
      });
    } catch (error) {
      setStatus({
        code: error instanceof Error ? error.message : 'unknown',
        kind: 'failure'
      });
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <StyledText variant="title">{translate('frontendQuality.selector.title')}</StyledText>
      <StyledText variant="body">{translate('frontendQuality.selector.warning')}</StyledText>

      <View style={styles.grid}>
        {frontendQualityScenarios.map((scenario) => {
          const active = selected === scenario.id;
          return (
            <Pressable
              key={scenario.id}
              accessibilityLabel={`Select ${scenario.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(scenario.id)}
              style={[
                styles.option,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderColor: theme.colors.border,
                  minHeight: minTouchTarget
                }
              ]}
            >
              <StyledText
                variant="subtitle"
                style={{ color: active ? theme.colors.textInverse : theme.colors.textPrimary }}
              >
                {translate(`frontendQuality.scenarios.${scenario.id}.name`)}
              </StyledText>
              <StyledText
                variant="caption"
                style={{ color: active ? theme.colors.textInverse : theme.colors.textSecondary }}
              >
                {translate(`frontendQuality.scenarios.${scenario.id}.description`)}
              </StyledText>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityLabel={translate('frontendQuality.selector.confirm')}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        onPress={() => setConfirmed((value) => !value)}
        style={styles.confirm}
      >
        <StyledText variant="body">
          {confirmed ? '✓ ' : '☐ '}
          {translate('frontendQuality.selector.confirm')}
        </StyledText>
      </Pressable>

      <ActionButton
        label="frontendQuality.selector.reset"
        loading={status.kind === 'loading'}
        onPress={resetSelected}
      />

      <StatusCard status={status} />
    </ScrollView>
  );
}

function StatusCard({ status }: { status: Status }) {
  if (status.kind === 'idle' || status.kind === 'loading') return null;
  if (status.kind === 'failure') {
    return (
      <SurfaceCard>
        <StyledText variant="body" accessibilityLiveRegion="polite">
          {translateDynamic('frontendQuality.selector.failure', { code: status.code })}
        </StyledText>
      </SurfaceCard>
    );
  }
  return (
    <SurfaceCard>
      <StyledText variant="body" accessibilityLiveRegion="polite">
        {translateDynamic('frontendQuality.selector.success', { scenario: status.scenarioId })}
      </StyledText>
      <StyledText variant="subtitle">{translate('frontendQuality.selector.routeLinks')}</StyledText>
      {status.routes.map((route) => (
        <StyledText key={route} variant="body">
          {route}
        </StyledText>
      ))}
    </SurfaceCard>
  );
}

export function FrontendQualityScenarioUnavailableScreen() {
  return (
    <View style={styles.content}>
      <StyledText variant="title">{translate('frontendQuality.selector.title')}</StyledText>
      <StyledText variant="body">{translate('frontendQuality.selector.unavailable')}</StyledText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 16, padding: 16 },
  grid: { gap: 8 },
  option: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    padding: 12
  },
  confirm: {
    minHeight: minTouchTarget,
    justifyContent: 'center'
  }
});
