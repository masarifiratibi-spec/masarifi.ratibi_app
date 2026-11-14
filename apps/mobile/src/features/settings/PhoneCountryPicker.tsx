import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList, Modal, Pressable, StyleSheet } from 'react-native';
import {
  getCountries,
  getCountryCallingCode,
  type CountryCode
} from 'libphonenumber-js/min';

import { StyledText } from '@/components/StyledText';
import { FormField } from '@/design-system/components/forms/FormField';
import { translateDynamic as t } from '@/localization/i18n';
import { normalizeLocalizedNumber } from '@/domain/localized-number';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import names from './phone-country-names.json';

export function PhoneCountryPicker({
  country,
  onSelect
}: {
  country: CountryCode;
  onSelect(country: CountryCode): void;
}) {
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const countryName = (code: CountryCode) =>
    names[code][locale === 'ar' ? 0 : 1];
  const label = (code: CountryCode) =>
    countryName(code) +
    '  ' +
    '\u2066+' +
    getCountryCallingCode(code) +
    '\u2069';
  const term = normalizeLocalizedNumber(search).toLowerCase();
  const countries = !open
    ? []
    : getCountries()
        .filter((code) =>
          [...names[code], code, '+' + getCountryCallingCode(code)].some(
            (value) => value.toLowerCase().includes(term)
          )
        )
        .sort((a, b) => countryName(a).localeCompare(countryName(b), locale));
  return (
    <>
      <StyledText>{t('appShell.auth.phone.countryCode')}</StyledText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('appShell.auth.phone.countryCode')}
        accessibilityValue={{ text: '+' + getCountryCallingCode(country) }}
        onPress={() => {
          setSearch('');
          setOpen(true);
        }}
        style={[styles.row, { borderColor: theme.colors.border }]}
      >
        <StyledText>{label(country)} ▾</StyledText>
      </Pressable>
      {open && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <SafeAreaView
            style={[
              styles.panel,
              { backgroundColor: theme.colors.surface, direction }
            ]}
            accessibilityViewIsModal
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={styles.close}
            >
              <StyledText>{t('common.close')}</StyledText>
            </Pressable>
            <FormField
              label={t('common.search')}
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={countries}
              keyExtractor={(code) => code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item === country }}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  style={[styles.row, { borderColor: theme.colors.border }]}
                >
                  <StyledText>{label(item)}</StyledText>
                </Pressable>
              )}
            />
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: 20, gap: 12 },
  close: { alignSelf: 'flex-end', padding: 12 },
  row: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  }
});
