import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignIcon } from '@/design-system/icons';
import { colorTokens, radius, spacing, typography } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';
import type { SelectionItem, SelectionItemRenderProps } from './selection-types';

export function DefaultGridItem<T = string>({
  item,
  isSelected,
  onPress,
  theme
}: SelectionItemRenderProps<T>) {
  return (
    <Pressable
      accessibilityLabel={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: item.disabled }}
      disabled={item.disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridCell,
        {
          backgroundColor: isSelected
            ? theme.colors.surfaces.brandSubtle
            : pressed
              ? theme.colors.surfaceMuted
              : theme.colors.surface,
          borderColor: isSelected
            ? colorTokens.teal[300]
            : theme.colors.borders.subtle
        },
        item.disabled && styles.disabled
      ]}
    >
      <Text
        style={[
          styles.gridTitle,
          {
            color: isSelected ? colorTokens.teal[900] : theme.colors.textPrimary,
            textAlign: 'center'
          }
        ]}
      >
        {item.title}
      </Text>

      {item.subtitle ? (
        <Text
          style={[
            styles.gridSubtitle,
            {
              color: isSelected ? colorTokens.teal[700] : theme.colors.textSecondary,
              textAlign: 'center'
            }
          ]}
        >
          {item.subtitle}
        </Text>
      ) : null}

      {isSelected ? (
        <View style={styles.selectedBadge}>
          <DesignIcon
            name="check"
            label="Selected"
            color={colorTokens.teal[700]}
            size="xs"
            decorative
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export function SelectionGrid<T = string>({
  items,
  selectedId,
  numColumns = 4,
  onSelect,
  renderItem,
  direction,
  emptyStateText
}: {
  items: readonly SelectionItem<T>[];
  selectedId?: T | null;
  numColumns?: number;
  onSelect: (item: SelectionItem<T>) => void;
  renderItem?: (props: SelectionItemRenderProps<T>) => React.ReactNode;
  direction: 'rtl' | 'ltr';
  emptyStateText?: string;
}) {
  const theme = useTheme();
  const isRtl = direction === 'rtl';

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

  // Chunk items into rows
  const rows: SelectionItem<T>[][] = [];
  for (let i = 0; i < items.length; i += numColumns) {
    rows.push(items.slice(i, i + numColumns) as SelectionItem<T>[]);
  }

  return (
    <View style={styles.gridContainer}>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          testID={`selection-grid-row-${rowIndex}`}
          style={[
            styles.row,
            styles.physicalLtr,
            { flexDirection: isRtl ? 'row-reverse' : 'row' }
          ]}
        >
          {row.map((item) => {
            const isSelected =
              selectedId !== undefined && selectedId !== null && item.id === selectedId;
            const handlePress = () => onSelect(item);

            if (renderItem) {
              return (
                <View key={String(item.id)} style={styles.cellWrapper}>
                  {renderItem({
                    item,
                    isSelected,
                    onPress: handlePress,
                    direction,
                    theme
                  })}
                </View>
              );
            }

            return (
              <View key={String(item.id)} style={styles.cellWrapper}>
                <DefaultGridItem
                  item={item}
                  isSelected={isSelected}
                  onPress={handlePress}
                  direction={direction}
                  theme={theme}
                />
              </View>
            );
          })}

          {/* Fill phantom empty cells in the last row if row length < numColumns */}
          {Array.from({ length: numColumns - row.length }).map((_, emptyIndex) => (
            <View
              key={`empty-${emptyIndex}`}
              style={[styles.cellWrapper, styles.phantomCell]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  physicalLtr: {
    direction: 'ltr',
    display: 'flex',
    writingDirection: 'ltr'
  },
  gridContainer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl
  },
  row: {
    gap: spacing.sm,
    justifyContent: 'space-between'
  },
  cellWrapper: {
    flex: 1
  },
  phantomCell: {
    opacity: 0
  },
  gridCell: {
    alignItems: 'center',
    borderRadius: radius.overlay,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 72,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm
  },
  disabled: {
    opacity: 0.4
  },
  gridTitle: {
    ...typography.subtitle,
    fontWeight: '700'
  },
  gridSubtitle: {
    fontSize: 10,
    lineHeight: 14
  },
  selectedBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
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
