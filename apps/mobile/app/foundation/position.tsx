/**
 * /foundation/position — User Story 1 validation harness.
 *
 * Cycles through populated, empty, and partial summary fixtures so a reviewer
 * can confirm the panel communicates a clear position in each data state.
 * This is a validation route, not a production screen (Scope Contract §11).
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FinancialPositionPanel } from '@/features/foundation/FinancialPositionPanel';
import { StyledText } from '@/components/StyledText';
import { useTheme } from '@/state/theme-context';
import { minTouchTarget } from '@/design-system/tokens';
import { summaries } from '@/services/mocks/financial-summary';
import type { FinancialSummary } from '@/services/contracts/foundation-service';
import { translate } from '@/localization/i18n';

type ScenarioName = keyof typeof summaries;

const SCENARIO_ORDER: ScenarioName[] = ['populated', 'empty', 'partial'];

export default function PositionHarness() {
  const theme = useTheme();
  const [scenario, setScenario] = useState<ScenarioName>('populated');
  const summary: FinancialSummary = summaries[scenario];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.scenarioBar}>
        {SCENARIO_ORDER.map((name) => {
          const label = translate(`scenario.${name}`);
          return (
            <Pressable
              key={name}
              onPress={() => setScenario(name)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={[
                styles.scenarioButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor:
                    scenario === name
                      ? theme.colors.primary
                      : theme.colors.surface,
                  minHeight: minTouchTarget
                }
              ]}
            >
              <StyledText
                variant="body"
                style={{
                  color:
                    scenario === name
                      ? theme.colors.textInverse
                      : theme.colors.textPrimary
                }}
              >
                {label}
              </StyledText>
            </Pressable>
          );
        })}
      </View>

      <FinancialPositionPanel summary={summary} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  scenarioBar: { flexDirection: 'row', gap: 8 },
  scenarioButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  }
});
