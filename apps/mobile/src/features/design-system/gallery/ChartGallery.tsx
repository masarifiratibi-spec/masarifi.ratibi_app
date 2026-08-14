import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AccessibleChartFrame } from '@/design-system/charts/AccessibleChartFrame';
import { DonutChart } from '@/design-system/charts/DonutChart';
import { LineChart } from '@/design-system/charts/LineChart';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function ChartGallery() {
  const theme = useTheme();
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <AccessibleChartFrame
        question={translate('designSystem.gallery.charts')}
        summary={translate('designSystem.chart.donutSummary')}
        drillDownLabel="Open chart details"
        onDrillDown={() => undefined}
      >
        <DonutChart
          data={[
            { label: 'Food', value: 50 },
            { label: 'Rent', value: 30 },
            { label: 'Bills', value: 20 },
            { label: 'Transport', value: 10 },
            { label: 'Health', value: 5 },
            { label: 'Other raw', value: 5 }
          ]}
        />
      </AccessibleChartFrame>
      <LineChart
        series={[
          { label: 'Income', values: [1, 2] },
          { label: 'Expense', values: [2, 3] }
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    gap: 16,
    padding: 16
  }
});
