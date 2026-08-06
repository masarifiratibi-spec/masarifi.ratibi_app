/**
 * /foundation/trust — User Story 3 validation harness.
 *
 * Lets a reviewer trigger clear, ambiguous, duplicate, failed, and
 * assistant-proposed mock changes to verify each allowed transition and the
 * sensitive-display rules. Validation route, not a production screen.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FinancialTrustPanel } from '@/features/foundation/FinancialTrustPanel';
import { StyledText } from '@/components/StyledText';
import { useTheme } from '@/state/theme-context';
import { minTouchTarget } from '@/design-system/tokens';
import { FINANCIAL_CHANGE_SCENARIOS } from '@/services/mocks/financial-changes';
import type { FinancialChangeScenario } from '@/services/contracts/foundation-service';
import { translate } from '@/localization/i18n';

export default function TrustHarness() {
  const theme = useTheme();
  const [scenario, setScenario] = useState<FinancialChangeScenario>('clear');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.scenarioBar}>
        {FINANCIAL_CHANGE_SCENARIOS.map((name) => {
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

      <FinancialTrustPanel scenario={scenario} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  scenarioBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scenarioButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  }
});
