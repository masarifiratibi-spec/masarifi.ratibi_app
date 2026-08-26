import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { DesignIcon } from '@/design-system/icons';
import { colorTokens, radius, spacing } from '@/design-system/tokens';
import { AccountPicker } from '@/features/transactions/AccountPicker';
import { translate } from '@/localization/i18n';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { usePreferenceStore } from '@/state/preferences';

/**
 * Shared account scope selector: "All Accounts" or one specific account.
 * Home and Transactions both open this sheet, and both read the selection
 * from `useCoreFinanceViewState` so they can never disagree.
 */
export function AccountScopeSheet({
  visible,
  onDismiss
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const selectedAccountId = useCoreFinanceViewState(
    (state) => state.selectedAccountId
  );
  const selectAccount = useCoreFinanceViewState((state) => state.selectAccount);
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  const close = () => {
    onDismiss();
  };

  const choose = (accountId: string | null) => {
    selectAccount(accountId);
    close();
  };

  const handleManageAccounts = () => {
    close();
    router.push('/accounts');
  };

  return (
    <AppSheet
      appearance="menu"
      title={translate('coreFinance.home.accountScope.title')}
      visible={visible}
      onDismiss={close}
    >
      <View
        testID="account-scope-sheet"
        style={[styles.container, { direction }]}
      >
        {/* 1. All Accounts Card */}
        <AllAccountsOption
          selected={selectedAccountId === null}
          onPress={() => choose(null)}
          direction={direction}
          isRtl={isRtl}
        />

        {/* 2. Search & Account List */}
        <View style={styles.pickerContainer}>
          <AccountPicker
            appearance="grouped"
            selectedId={selectedAccountId ?? undefined}
            onSelect={(account) => choose(account.id)}
          />
        </View>

        {/* 3. Manage Accounts Action Card */}
        <Pressable
          testID="account-scope-manage-accounts"
          accessibilityLabel={translate('coreFinance.home.manageAccounts')}
          accessibilityRole="button"
          onPress={handleManageAccounts}
          style={({ pressed }) => [
            styles.manageCard,
            pressed && styles.cardPressed
          ]}
        >
          {/* START: Settings icon badge & label */}
          <View style={[styles.manageIdentity, { flexDirection: 'row' }]}>
            <View style={styles.iconBadge}>
              <DesignIcon
                name="settings"
                size="sm"
                color={colorTokens.teal['700']}
                direction={direction}
                decorative
              />
            </View>
            <Text
              style={[
                styles.manageLabel,
                {
                  textAlign: isRtl ? 'right' : 'left',
                  writingDirection: direction
                }
              ]}
            >
              {translate('coreFinance.home.manageAccounts')}
            </Text>
          </View>

          {/* END: Chevron pointing in reading direction (left in RTL, right in LTR) */}
          <DesignIcon
            name="chevronEnd"
            size="sm"
            color={colorTokens.ink['500']}
            direction={direction}
            decorative
          />
        </Pressable>

        {/* 4. Cancel Button */}
        <Pressable
          testID="account-scope-cancel-button"
          accessibilityRole="button"
          accessibilityLabel={translate('coreFinance.cancel')}
          onPress={close}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.cardPressed
          ]}
        >
          <Text style={styles.cancelText}>
            {translate('coreFinance.cancel')}
          </Text>
        </Pressable>
      </View>
    </AppSheet>
  );
}

function AllAccountsOption({
  selected,
  onPress,
  direction,
  isRtl
}: {
  selected: boolean;
  onPress: () => void;
  direction: 'rtl' | 'ltr';
  isRtl: boolean;
}) {
  const label = translate('coreFinance.home.allAccounts');

  return (
    <Pressable
      testID="account-scope-all"
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.allAccountsCard,
        {
          backgroundColor: selected
            ? colorTokens.teal['50']
            : colorTokens.sand['50'],
          borderColor: selected
            ? colorTokens.teal['700']
            : colorTokens.sand['400'],
          borderWidth: selected ? 1.5 : 1
        },
        pressed && styles.cardPressed
      ]}
    >
      {/* START: Icon & Title */}
      <View style={[styles.allAccountsIdentity, { flexDirection: 'row' }]}>
        <View style={styles.iconBadge}>
          <DesignIcon
            name="accounts"
            size="sm"
            color={colorTokens.teal['700']}
            direction={direction}
            decorative
          />
        </View>
        <Text
          style={[
            styles.allAccountsTitle,
            {
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {label}
        </Text>
      </View>

      {/* END: Selected Checkmark indicator */}
      {selected ? (
        <View style={styles.checkCircle}>
          <DesignIcon
            name="check"
            size="xs"
            color={colorTokens.surface.white}
            direction={direction}
            decorative
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingTop: spacing.xs
  },
  allAccountsCard: {
    alignItems: 'center',
    borderRadius: radius.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  allAccountsIdentity: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md
  },
  allAccountsTitle: {
    color: colorTokens.ink['900'],
    fontSize: 16,
    fontWeight: '700'
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: colorTokens.teal['50'],
    borderColor: colorTokens.teal['100'],
    borderRadius: radius.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  checkCircle: {
    alignItems: 'center',
    backgroundColor: colorTokens.teal['700'],
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24
  },
  pickerContainer: {
    maxHeight: 440
  },
  manageCard: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.card,
    borderWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.sm
  },
  manageIdentity: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md
  },
  manageLabel: {
    color: colorTokens.ink['900'],
    fontSize: 15.5,
    fontWeight: '700'
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    minHeight: 44
  },
  cancelText: {
    color: colorTokens.teal['700'],
    fontSize: 16,
    fontWeight: '700'
  },
  cardPressed: {
    opacity: 0.8
  }
});
