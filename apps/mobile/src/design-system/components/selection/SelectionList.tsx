import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignIcon } from '@/design-system/icons';
import { colorTokens, minTouchTarget, radius, spacing, typography } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';
import type { SelectionItem, SelectionItemRenderProps } from './selection-types';

export function DefaultListItem<T = string>({
  item,
  isSelected,
  onPress,
  direction,
  theme
}: SelectionItemRenderProps<T>) {
  const isRtl = direction === 'rtl';

  return (
    <Pressable
      accessibilityLabel={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: item.disabled }}
      disabled={item.disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        styles.physicalLtr,
        {
          backgroundColor: isSelected
            ? theme.colors.surfaces.brandSubtle
            : pressed
              ? theme.colors.surfaceMuted
              : theme.colors.surface,
          borderColor: isSelected
            ? colorTokens.teal[300]
            : theme.colors.borders.subtle,
          flexDirection: isRtl ? 'row-reverse' : 'row'
        },
        item.disabled && styles.disabled
      ]}
    >
      {/* Leading / Icon */}
      {item.leading ? (
        item.leading
      ) : item.icon ? (
        typeof item.icon === 'string' ? (
          <Text style={styles.emojiIcon}>{item.icon}</Text>
        ) : (
          item.icon
        )
      ) : null}

      {/* Main Text Content */}
      <View
        style={[
          styles.textContainer,
          { alignItems: isRtl ? 'flex-end' : 'flex-start' }
        ]}
      >
        <Text
          style={[
            styles.title,
            {
              color: isSelected
                ? colorTokens.teal[900]
                : theme.colors.textPrimary,
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.textSecondary,
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: direction
              }
            ]}
          >
            {item.subtitle}
          </Text>
        ) : null}
      </View>

      {/* Trailing / Checkmark */}
      {item.trailing ? (
        item.trailing
      ) : isSelected ? (
        <View style={styles.checkBadge}>
          <DesignIcon
            name="check"
            label="Selected"
            color={colorTokens.teal[700]}
            size="sm"
            decorative
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export function SelectionList<T = string>({
  items,
  selectedId,
  onSelect,
  renderItem,
  direction,
  emptyStateText
}: {
  items: readonly SelectionItem<T>[];
  selectedId?: T | null;
  onSelect: (item: SelectionItem<T>) => void;
  renderItem?: (props: SelectionItemRenderProps<T>) => React.ReactNode;
  direction: 'rtl' | 'ltr';
  emptyStateText?: string;
}) {
  const theme = useTheme();

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text
          style={[
            styles.emptyText,
            { color: theme.colors.content.muted }
          ]}
        >
          {emptyStateText ?? '—'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {items.map((item) => {
        const isSelected = selectedId !== undefined && selectedId !== null && item.id === selectedId;
        const handlePress = () => onSelect(item);

        if (renderItem) {
          return (
            <React.Fragment key={String(item.id)}>
              {renderItem({
                item,
                isSelected,
                onPress: handlePress,
                direction,
                theme
              })}
            </React.Fragment>
          );
        }

        return (
          <DefaultListItem
            key={String(item.id)}
            item={item}
            isSelected={isSelected}
            onPress={handlePress}
            direction={direction}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  physicalLtr: {
    display: 'flex',
    writingDirection: 'ltr'
  },
  listContainer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl
  },
  listRow: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  disabled: {
    opacity: 0.4
  },
  emojiIcon: {
    fontSize: 24,
    lineHeight: 28
  },
  textContainer: {
    flex: 1,
    gap: 2
  },
  title: {
    ...typography.body,
    fontWeight: '600'
  },
  subtitle: {
    ...typography.caption
  },
  checkBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl
  },
  emptyText: {
    ...typography.body
  }
});
