import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignIcon } from '@/design-system/icons';
import { minTouchTarget, spacing } from '@/design-system/tokens';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export interface AttentionItem {
  title: string;
  reason: string;
  consequence: string;
  status: string;
  actionLabel: string;
  onPress: () => void;
}

export function AttentionRail({
  label,
  items
}: {
  label: string;
  items: AttentionItem[];
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  if (items.length === 0) return null;

  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.rail,
        {
          backgroundColor: theme.colors.surfaces.attention,
          borderColor: theme.colors.accent
        }
      ]}
    >
      <View
        style={[
          styles.heading,
          {
            direction: 'ltr',
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
          }
        ]}
      >
        <DesignIcon
          name="warning"
          label={label}
          color={theme.colors.status.warning}
          size="sm"
          decorative
        />
        <Text style={[styles.headingText, { color: theme.colors.status.warning }]}>{label}</Text>
      </View>
      {items.map((item) => (
        <AttentionRow item={item} key={`${item.title}-${item.status}`} />
      ))}
    </View>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const accessibilityLabel = [item.title, item.reason, item.consequence, item.status]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityHint={item.actionLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={item.onPress}
      style={({ pressed }) => [
        styles.item,
        {
          borderTopColor: theme.colors.borders.subtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          direction: 'ltr',
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
          minHeight: minTouchTarget
        },
        pressed && { backgroundColor: theme.colors.interactions.quietPressed }
      ]}
    >
      <View style={[styles.dot, { backgroundColor: theme.colors.status.warning }]} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.colors.content.primary }]}>{item.title}</Text>
        {item.reason ? (
          <Text style={[styles.reason, { color: theme.colors.content.secondary }]}>{item.reason}</Text>
        ) : null}
        {item.consequence ? (
          <Text style={[styles.reason, { color: theme.colors.content.secondary }]}>{item.consequence}</Text>
        ) : null}
        {item.status ? (
          <Text style={[styles.status, { color: theme.colors.status.conflict }]}>{item.status}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing.md
  },
  heading: {
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.xs
  },
  headingText: {
    fontSize: 15,
    fontWeight: '700'
  },
  item: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm
  },
  dot: {
    borderRadius: 3,
    height: 6,
    width: 6
  },
  text: {
    flex: 1,
    gap: spacing.xs
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24
  },
  reason: {
    fontSize: 14,
    lineHeight: 20
  },
});
