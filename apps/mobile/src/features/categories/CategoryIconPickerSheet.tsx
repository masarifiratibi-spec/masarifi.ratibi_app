import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { layoutDirectionStyle } from '@/design-system/direction';
import { radius, spacing } from '@/design-system/tokens';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { colorTokens } from '@/design-system/tokens';

/**
 * Emoji sections matching the reference visual groups.
 * Each entry has a section title key and an array of icon descriptors.
 * We map known DesignIconName values with an emoji character for the tile display.
 */
export interface EmojiIconTile {
  key: string; // passed as iconKey
  emoji: string;
  labelKey: string;
}

const ICON_SECTIONS: {
  titleAr: string;
  titleEn: string;
  tiles: EmojiIconTile[];
}[] = [
  {
    titleAr: 'المصروفات',
    titleEn: 'SPENDING',
    tiles: [
      { key: 'shopping', emoji: '🛒', labelKey: 'coreFinance.categories.icon.shopping' },
      { key: 'food', emoji: '🍔', labelKey: 'coreFinance.categories.icon.restaurant' },
      { key: 'restaurants', emoji: '🍜', labelKey: 'coreFinance.categories.icon.restaurant' },
      { key: 'coffee', emoji: '☕', labelKey: 'coreFinance.category.food' },
      { key: 'pizza', emoji: '🍕', labelKey: 'coreFinance.category.food' },
      { key: 'cake', emoji: '🎂', labelKey: 'coreFinance.category.food' },
      { key: 'health', emoji: '💊', labelKey: 'coreFinance.categories.icon.health' },
      { key: 'charity', emoji: '🎁', labelKey: 'coreFinance.categories.icon.charity' },
      { key: 'subscriptions', emoji: '💳', labelKey: 'coreFinance.category.subscriptions' },
      { key: 'entertainment', emoji: '🎬', labelKey: 'coreFinance.categories.icon.entertainment' },
      { key: 'fees', emoji: '🏷️', labelKey: 'coreFinance.category.fees' },
      { key: 'receipt', emoji: '🧾', labelKey: 'coreFinance.categories.icon.receipt' }
    ]
  },
  {
    titleAr: 'المواصلات والتنقل',
    titleEn: 'GETTING AROUND',
    tiles: [
      { key: 'travel', emoji: '✈️', labelKey: 'coreFinance.categories.icon.travel' },
      { key: 'transportation', emoji: '🚗', labelKey: 'coreFinance.categories.icon.car' },
      { key: 'metro', emoji: '🚇', labelKey: 'coreFinance.category.transportation' },
      { key: 'bus', emoji: '🚌', labelKey: 'coreFinance.category.transportation' },
      { key: 'taxi', emoji: '🚕', labelKey: 'coreFinance.category.transportation' },
      { key: 'fuel', emoji: '⛽', labelKey: 'coreFinance.category.fuel' },
      { key: 'scooter', emoji: '🛵', labelKey: 'coreFinance.category.transportation' },
      { key: 'bicycle', emoji: '🚲', labelKey: 'coreFinance.category.transportation' }
    ]
  },
  {
    titleAr: 'المنزل والفواتير',
    titleEn: 'HOME & BILLS',
    tiles: [
      { key: 'housing', emoji: '🏠', labelKey: 'coreFinance.categories.icon.home' },
      { key: 'utilities', emoji: '💡', labelKey: 'coreFinance.category.utilities' },
      { key: 'water', emoji: '💧', labelKey: 'coreFinance.category.utilities' },
      { key: 'fire', emoji: '🔥', labelKey: 'coreFinance.category.utilities' },
      { key: 'communication', emoji: '📱', labelKey: 'coreFinance.categories.icon.communication' },
      { key: 'internet', emoji: '📶', labelKey: 'coreFinance.category.communication' },
      { key: 'tv', emoji: '📺', labelKey: 'coreFinance.category.entertainment' },
      { key: 'obligations', emoji: '🧾', labelKey: 'coreFinance.category.obligations' }
    ]
  },
  {
    titleAr: 'الحياة والصحة',
    titleEn: 'LIFE & HEALTH',
    tiles: [
      { key: 'education', emoji: '🎓', labelKey: 'coreFinance.categories.icon.education' },
      { key: 'gym', emoji: '💪', labelKey: 'coreFinance.category.health' },
      { key: 'books', emoji: '📚', labelKey: 'coreFinance.category.education' },
      { key: 'scissors', emoji: '✂️', labelKey: 'coreFinance.category.health' },
      { key: 'healthcare', emoji: '🏥', labelKey: 'coreFinance.categories.icon.health' },
      { key: 'salary', emoji: '💰', labelKey: 'coreFinance.category.salary' },
      { key: 'income', emoji: '💵', labelKey: 'coreFinance.category.otherIncome' },
      { key: 'transfers', emoji: '🔄', labelKey: 'coreFinance.categories.icon.transactions' }
    ]
  }
];

export function CategoryIconPickerSheet({
  visible,
  selectedKey,
  onSelect,
  onClose
}: {
  visible: boolean;
  selectedKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const isRtl = direction === 'rtl';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.colors.surface }
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.colors.borders?.subtle ?? colorTokens.raw["E0E0E0"] }
            ]}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {ICON_SECTIONS.map((section) => (
            <View key={section.titleEn} style={styles.section}>
              {/* Section title */}
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: theme.colors.textSecondary,
                    textAlign: isRtl ? 'right' : 'left',
                    writingDirection: direction
                  }
                ]}
              >
                {locale === 'ar' ? section.titleAr : section.titleEn}
              </Text>

              {/* Emoji grid */}
              <View
                style={[
                  styles.grid,
                  { flexDirection: isRtl ? 'row-reverse' : 'row' }
                ]}
              >
                {section.tiles.map((tile) => {
                  const isSelected = selectedKey === tile.key;
                  return (
                    <Pressable
                      key={tile.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onSelect(tile.key);
                        onClose();
                      }}
                      style={[
                        styles.tile,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.surfaces?.brandSubtle ?? colorTokens.raw["E8F5F0"]
                            : theme.colors.surfaces?.grouped ?? colorTokens.raw["F6F7F5"],
                          borderColor: isSelected
                            ? theme.colors.primary ?? colorTokens.raw["103F37"]
                            : 'transparent',
                          borderWidth: isSelected ? 2 : 0
                        }
                      ]}
                    >
                      <Text style={styles.tileEmoji}>{tile.emoji}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 29, 25, 0.52)'
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '75%',
    paddingBottom: 32
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10
  },
  handle: {
    borderRadius: 3,
    height: 4,
    width: 40
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl
  },
  section: {
    marginBottom: spacing.xl
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: spacing.md,
    textTransform: 'uppercase'
  },
  grid: {
    ...layoutDirectionStyle('ltr'),
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  tile: {
    alignItems: 'center',
    borderRadius: radius.lg,
    height: 52,
    justifyContent: 'center',
    width: 52
  },
  tileEmoji: {
    fontSize: 26
  }
});

/**
 * Resolve the display emoji for a given iconKey.
 * Falls back to a generic icon character if no emoji mapping found.
 */
export function resolveEmojiForKey(iconKey: string): string {
  for (const section of ICON_SECTIONS) {
    const found = section.tiles.find((t) => t.key === iconKey);
    if (found) return found.emoji;
  }
  return '📁';
}
