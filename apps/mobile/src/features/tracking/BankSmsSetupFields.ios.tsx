import { useState } from 'react';
import {
  ActionSheetIOS,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';

import { StyledText } from '@/components/StyledText';
import { FormField } from '@/design-system/components/forms/FormField';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { DesignIcon } from '@/design-system/icons';
import { useTheme } from '@/state/theme-context';
import { minTouchTarget, spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import type {
  BankSmsAccountChoice,
  BankSmsAccountLink,
  BankSmsConfiguration
} from '@/services/platform/bank-sms-bridge.ios';
import type { readBankSmsSetup } from '@/services/platform/bank-sms-setup.ios';
import { usePreferenceStore } from '@/state/preferences';

type Setup = Awaited<ReturnType<typeof readBankSmsSetup>>;
export function BankSmsSetupFields({
  setup,
  value,
  onChange,
  disabled
}: {
  setup: Setup;
  value?: BankSmsConfiguration;
  onChange: (configuration: BankSmsConfiguration) => void;
  disabled: boolean;
}) {
  const direction = usePreferenceStore((state) => state.direction);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const { colors } = useTheme();
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState<string>();
  const accounts = setup.accounts ?? [];
  const linked = accounts.filter((account) => account.automaticRouting);
  const account = linked.find((choice) => choice.id === editing);
  const draft = value ?? {
    links: Object.fromEntries(
      accounts.map(({ id, accountEnding, issuer, cashAccountId }) => [
        id,
        { accountEnding, issuer, cashAccountId }
      ])
    )
  };
  const updateLink = (
    current: BankSmsAccountChoice,
    patch: BankSmsAccountLink
  ) => {
    onChange({
      ...draft,
      links: {
        ...draft.links,
        [current.id]: { ...draft.links?.[current.id], ...patch }
      }
    });
  };
  const pick = (labels: string[], select: (index: number) => void) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, translate('designSystem.action.cancel')],
        cancelButtonIndex: labels.length
      },
      (index) => {
        if (index < labels.length) select(index);
      }
    );
  };
  const link = account && draft.links?.[account.id];
  const incomplete = linked.filter(({ id }) => {
    const length = draft.links?.[id]?.accountEnding?.length;
    return length && length !== 4;
  });
  const cashAccounts = accounts.filter(
    (choice) => choice.type === 'cash' && choice.currency === account?.currency
  );
  return (
    <SurfaceCard style={styles.card}>
      {linked.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${translate('tracking.bankSms.linkAccount')}, ${account?.name ?? translate('tracking.bankSms.chooseAccount')}`}
          accessibilityState={{ disabled, expanded: choosing }}
          disabled={disabled}
          onPress={() => setChoosing(true)}
          style={styles.accountRow}
        >
          <StyledText variant="subtitle">
            {translate('tracking.bankSms.linkAccount')}
          </StyledText>
          <View style={styles.value}>
            <StyledText
              variant="subtitle"
              style={{ color: colors.content.link }}
            >
              {account?.name ?? translate('tracking.bankSms.chooseAccount')}
            </StyledText>
            <DesignIcon
              name="chevronEnd"
              direction={direction}
              size="sm"
              decorative
              color={colors.content.link}
            />
          </View>
        </Pressable>
      ) : (
        <>
          <StyledText variant="subtitle">
            tracking.bankSms.linkAccount
          </StyledText>
          <StyledText>tracking.bankSms.noTrackingAccounts</StyledText>
        </>
      )}
      {choosing && (
        <AppSheet
          visible
          appearance="menu"
          animationType={reducedMotion ? 'none' : 'slide'}
          title={translate('tracking.bankSms.pickDestination')}
          onDismiss={() => setChoosing(false)}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.sheetList}
          >
            {linked.map((choice) => (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                accessibilityLabel={choice.name}
                accessibilityState={{ selected: choice.id === editing }}
                style={[
                  styles.choice,
                  { borderBottomColor: colors.borders.default }
                ]}
                onPress={() => {
                  setEditing(choice.id);
                  setChoosing(false);
                }}
              >
                <StyledText
                  variant="subtitle"
                  style={{ color: colors.content.link }}
                >
                  {choice.name}
                </StyledText>
              </Pressable>
            ))}
          </ScrollView>
          <ActionButton
            label="designSystem.action.cancel"
            variant="secondary"
            onPress={() => setChoosing(false)}
          />
        </AppSheet>
      )}
      {account && (
        <View
          style={[styles.fields, { borderTopColor: colors.borders.default }]}
        >
          {account.lastFour && (
            <StyledText>
              {translate('tracking.bankSms.savedCardDigits')} {account.lastFour}
            </StyledText>
          )}
          <FormField
            label={translate('tracking.bankSms.accountDigits')}
            value={link?.accountEnding ?? ''}
            errorText={
              incomplete.some((choice) => choice.id === account.id)
                ? 'tracking.bankSms.fourDigitsRequired'
                : undefined
            }
            keyboardType="number-pad"
            maxLength={4}
            editable={!disabled}
            onChangeText={(text) =>
              updateLink(account, {
                accountEnding: text.replace(/[^0-9٠-٩۰-۹]/g, '')
              })
            }
          />
          <FormField
            label={translate('tracking.bankSms.issuer')}
            value={link?.issuer ?? ''}
            editable={!disabled}
            autoCorrect={false}
            maxLength={64}
            placeholder={account.institution ?? undefined}
            onChangeText={(issuer) => updateLink(account, { issuer })}
          />
          {cashAccounts.length > 0 && (
            <PickerField
              label={translate('tracking.bankSms.cashAccount')}
              value={
                cashAccounts.find((choice) => choice.id === link?.cashAccountId)
                  ?.name
              }
              placeholder={translate('tracking.bankSms.noCashAccount')}
              disabled={disabled}
              onPress={() =>
                pick(
                  [
                    translate('tracking.bankSms.noCashAccount'),
                    ...cashAccounts.map((choice) => choice.name)
                  ],
                  (index) =>
                    updateLink(account, {
                      cashAccountId: cashAccounts[index - 1]?.id
                    })
                )
              }
            />
          )}
        </View>
      )}
      {incomplete
        .filter((choice) => choice.id !== account?.id)
        .map((choice) => (
          <StyledText key={choice.id} accessibilityRole="alert">
            {choice.name} · {translate('tracking.bankSms.fourDigitsRequired')}
          </StyledText>
        ))}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: minTouchTarget
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs
  },
  fields: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    gap: spacing.sm
  },
  sheetList: { flexGrow: 0, marginBottom: spacing.md },
  choice: {
    justifyContent: 'center',
    minHeight: minTouchTarget,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth
  }
});
