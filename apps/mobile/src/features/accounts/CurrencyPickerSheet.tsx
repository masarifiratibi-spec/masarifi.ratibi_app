import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { layoutDirectionStyle } from '@/design-system/direction';
import { DesignIcon } from '@/design-system/icons';
import { colorTokens, spacing } from '@/design-system/tokens';
import {
  matchesCurrencySearch,
  supportedCurrencies
} from '@/domain/currencies';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function CurrencyPickerSheet({
  visible,
  selectedCurrency,
  onSelect,
  onClose
}: {
  visible: boolean;
  selectedCurrency: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const isRtl = direction === 'rtl';

  const [search, setSearch] = useState('');
  const t = (key: string) => translateDynamic(key, {}, locale);

  const filtered = supportedCurrencies.filter((item) =>
    matchesCurrencySearch(item, search)
  );

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
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.colors.borders?.subtle ?? colorTokens.raw["E0E0E0"] }
            ]}
          />
        </View>

        {/* Title */}
        <View
          style={[
            styles.header,
            styles.physicalLtr,
            { flexDirection: isRtl ? 'row-reverse' : 'row' }
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                color: theme.colors.textPrimary,
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: direction
              }
            ]}
          >
            {t('coreFinance.accounts.setup.currencyPickerTitle')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            hitSlop={8}
            style={styles.closeBtn}
          >
            <DesignIcon
              name="close"
              label={t('common.close')}
              color={theme.colors.textSecondary}
              size="control"
              decorative
            />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            styles.physicalLtr,
            {
              backgroundColor: theme.colors.surfaces?.grouped ?? colorTokens.raw["F8FAFB"],
              borderColor: theme.colors.borders?.subtle ?? colorTokens.raw["E8EFEC"],
              flexDirection: isRtl ? 'row-reverse' : 'row'
            }
          ]}
        >
          <DesignIcon
            name="search"
            label={t('common.search')}
            color={theme.colors.textSecondary}
            size="sm"
            decorative
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('coreFinance.accounts.setup.currencySearchPlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            style={[
              styles.searchInput,
              {
                color: theme.colors.textPrimary,
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: direction
              }
            ]}
          />
        </View>

        {/* Currency List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.map((item) => {
            const isSelected =
              item.code.toUpperCase() === selectedCurrency.toUpperCase();
            const name = locale === 'ar' ? item.nameAr : item.nameEn;

            return (
              <Pressable
                key={item.code}
                accessibilityRole="button"
                accessibilityLabel={`${item.flag} ${item.code} - ${name}`}
                onPress={() => {
                  onSelect(item.code);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.currencyRow,
                  styles.physicalLtr,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.surfaces?.brandSubtle ?? colorTokens.raw["EAF5F0"]
                      : pressed
                        ? theme.colors.surfaceMuted
                        : theme.colors.surface,
                    borderColor: isSelected
                      ? colorTokens.teal[600]
                      : theme.colors.borders?.subtle ?? colorTokens.raw["E8EFEC"],
                    flexDirection: isRtl ? 'row-reverse' : 'row'
                  }
                ]}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <View
                  style={[
                    styles.nameContainer,
                    { alignItems: isRtl ? 'flex-end' : 'flex-start' }
                  ]}
                >
                  <Text
                    style={[
                      styles.code,
                      {
                        color: isSelected
                          ? colorTokens.teal[800]
                          : theme.colors.textPrimary,
                        textAlign: isRtl ? 'right' : 'left',
                        writingDirection: direction
                      }
                    ]}
                  >
                    {item.code}
                  </Text>
                  <Text
                    style={[
                      styles.currencyName,
                      {
                        color: theme.colors.textSecondary,
                        textAlign: isRtl ? 'right' : 'left',
                        writingDirection: direction
                      }
                    ]}
                  >
                    {name}
                  </Text>
                </View>
                {isSelected ? (
                  <Text
                    style={{
                      color: colorTokens.teal[700],
                      fontSize: 16,
                      fontWeight: '700'
                    }}
                  >
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  physicalLtr: {
    ...layoutDirectionStyle('ltr'),
    display: 'flex',
    writingDirection: 'ltr'
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)'
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 400,
    paddingBottom: 24
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16
  },
  searchContainer: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 40
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingBottom: 20
  },
  currencyRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52
  },
  flag: {
    fontSize: 24
  },
  nameContainer: {
    flex: 1,
    gap: 2
  },
  code: {
    fontSize: 15,
    fontWeight: '700'
  },
  currencyName: {
    fontSize: 12
  }
});
