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
  labelAr: string;
  labelEn: string;
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
      {
        key: 'shopping',
        emoji: '🛒',
        labelAr: 'أيقونة التسوق',
        labelEn: 'Shopping icon'
      },
      {
        key: 'food',
        emoji: '🍔',
        labelAr: 'أيقونة البرغر',
        labelEn: 'Burger icon'
      },
      {
        key: 'restaurants',
        emoji: '🍜',
        labelAr: 'أيقونة المطاعم',
        labelEn: 'Restaurant icon'
      },
      {
        key: 'coffee',
        emoji: '☕',
        labelAr: 'أيقونة القهوة',
        labelEn: 'Coffee icon'
      },
      {
        key: 'pizza',
        emoji: '🍕',
        labelAr: 'أيقونة البيتزا',
        labelEn: 'Pizza icon'
      },
      {
        key: 'cake',
        emoji: '🎂',
        labelAr: 'أيقونة الكعك',
        labelEn: 'Cake icon'
      },
      {
        key: 'health',
        emoji: '💊',
        labelAr: 'أيقونة الأدوية',
        labelEn: 'Medicine icon'
      },
      {
        key: 'charity',
        emoji: '🎁',
        labelAr: 'أيقونة الهدايا',
        labelEn: 'Gift icon'
      },
      {
        key: 'subscriptions',
        emoji: '💳',
        labelAr: 'أيقونة الاشتراكات',
        labelEn: 'Subscription icon'
      },
      {
        key: 'entertainment',
        emoji: '🎬',
        labelAr: 'أيقونة السينما',
        labelEn: 'Cinema icon'
      },
      {
        key: 'fees',
        emoji: '🏷️',
        labelAr: 'أيقونة الرسوم',
        labelEn: 'Fees icon'
      },
      {
        key: 'receipt',
        emoji: '🧾',
        labelAr: 'أيقونة الإيصال',
        labelEn: 'Receipt icon'
      }
    ]
  },
  {
    titleAr: 'المواصلات والتنقل',
    titleEn: 'GETTING AROUND',
    tiles: [
      {
        key: 'travel',
        emoji: '✈️',
        labelAr: 'أيقونة السفر الجوي',
        labelEn: 'Air travel icon'
      },
      {
        key: 'transportation',
        emoji: '🚗',
        labelAr: 'أيقونة السيارة',
        labelEn: 'Car icon'
      },
      {
        key: 'metro',
        emoji: '🚇',
        labelAr: 'أيقونة المترو',
        labelEn: 'Metro icon'
      },
      {
        key: 'bus',
        emoji: '🚌',
        labelAr: 'أيقونة الحافلة',
        labelEn: 'Bus icon'
      },
      {
        key: 'taxi',
        emoji: '🚕',
        labelAr: 'أيقونة سيارة الأجرة',
        labelEn: 'Taxi icon'
      },
      {
        key: 'fuel',
        emoji: '⛽',
        labelAr: 'أيقونة الوقود',
        labelEn: 'Fuel icon'
      },
      {
        key: 'scooter',
        emoji: '🛵',
        labelAr: 'أيقونة الدراجة النارية',
        labelEn: 'Scooter icon'
      },
      {
        key: 'bicycle',
        emoji: '🚲',
        labelAr: 'أيقونة الدراجة الهوائية',
        labelEn: 'Bicycle icon'
      }
    ]
  },
  {
    titleAr: 'المنزل والفواتير',
    titleEn: 'HOME & BILLS',
    tiles: [
      {
        key: 'housing',
        emoji: '🏠',
        labelAr: 'أيقونة المنزل',
        labelEn: 'Home icon'
      },
      {
        key: 'utilities',
        emoji: '💡',
        labelAr: 'أيقونة الكهرباء',
        labelEn: 'Electricity icon'
      },
      {
        key: 'water',
        emoji: '💧',
        labelAr: 'أيقونة المياه',
        labelEn: 'Water icon'
      },
      {
        key: 'fire',
        emoji: '🔥',
        labelAr: 'أيقونة الغاز',
        labelEn: 'Gas icon'
      },
      {
        key: 'communication',
        emoji: '📱',
        labelAr: 'أيقونة الهاتف',
        labelEn: 'Phone icon'
      },
      {
        key: 'internet',
        emoji: '📶',
        labelAr: 'أيقونة الإنترنت',
        labelEn: 'Internet icon'
      },
      {
        key: 'tv',
        emoji: '📺',
        labelAr: 'أيقونة التلفاز',
        labelEn: 'Television icon'
      },
      {
        key: 'obligations',
        emoji: '🧾',
        labelAr: 'أيقونة الالتزامات',
        labelEn: 'Obligations icon'
      }
    ]
  },
  {
    titleAr: 'الحياة والصحة',
    titleEn: 'LIFE & HEALTH',
    tiles: [
      {
        key: 'education',
        emoji: '🎓',
        labelAr: 'أيقونة التخرج',
        labelEn: 'Graduation icon'
      },
      {
        key: 'gym',
        emoji: '💪',
        labelAr: 'أيقونة الرياضة',
        labelEn: 'Fitness icon'
      },
      {
        key: 'books',
        emoji: '📚',
        labelAr: 'أيقونة الكتب',
        labelEn: 'Books icon'
      },
      {
        key: 'scissors',
        emoji: '✂️',
        labelAr: 'أيقونة العناية الشخصية',
        labelEn: 'Personal care icon'
      },
      {
        key: 'healthcare',
        emoji: '🏥',
        labelAr: 'أيقونة المستشفى',
        labelEn: 'Hospital icon'
      },
      {
        key: 'salary',
        emoji: '💰',
        labelAr: 'أيقونة الراتب',
        labelEn: 'Salary icon'
      },
      {
        key: 'income',
        emoji: '💵',
        labelAr: 'أيقونة الدخل',
        labelEn: 'Income icon'
      },
      {
        key: 'transfers',
        emoji: '🔄',
        labelAr: 'أيقونة التحويلات',
        labelEn: 'Transfers icon'
      }
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
      <Pressable
        testID="category-icon-picker-backdrop"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.backdrop}
        onPress={onClose}
      />
      <View
        testID="category-icon-picker-sheet"
        accessibilityViewIsModal
        style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View
            style={[
              styles.handle,
              {
                backgroundColor:
                  theme.colors.borders?.subtle ?? colorTokens.raw['E0E0E0']
              }
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
                      accessibilityLabel={
                        locale === 'ar' ? tile.labelAr : tile.labelEn
                      }
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onSelect(tile.key);
                        onClose();
                      }}
                      style={[
                        styles.tile,
                        {
                          backgroundColor: isSelected
                            ? (theme.colors.surfaces?.brandSubtle ??
                              colorTokens.raw['E8F5F0'])
                            : (theme.colors.surfaces?.grouped ??
                              colorTokens.raw['F6F7F5']),
                          borderColor: isSelected
                            ? (theme.colors.primary ??
                              colorTokens.raw['103F37'])
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
