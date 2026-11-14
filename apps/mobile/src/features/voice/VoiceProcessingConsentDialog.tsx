import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ActionButton } from '@/design-system/components/ActionButton';
import { DesignIcon } from '@/design-system/icons';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function VoiceProcessingConsentDialog({
  granted,
  busy,
  failed,
  onDismiss,
  onConfirm,
  onManual
}: {
  granted: boolean;
  busy: boolean;
  failed: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  onManual: () => void;
}) {
  const { colors } = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const insets = React.useContext(SafeAreaInsetsContext);
  const dismiss = () => {
    if (!busy) onDismiss();
  };
  return (
    <Modal
      testID="voice-processing-consent-modal"
      visible
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: (insets?.top ?? 0) + 24,
            paddingBottom: (insets?.bottom ?? 0) + 24
          }
        ]}
      >
        <Pressable
          testID="voice-processing-consent-backdrop"
          onPress={dismiss}
          disabled={busy}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: colors.horizon.scrim }
          ]}
        />
        <View
          testID="voice-processing-consent-dialog"
          accessibilityViewIsModal
          style={[
            styles.dialog,
            { backgroundColor: colors.surfaces.card, direction }
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('appShell.navigation.close')}
            disabled={busy}
            onPress={dismiss}
            style={[
              styles.close,
              direction === 'rtl' ? { left: 8 } : { right: 8 }
            ]}
          >
            <DesignIcon
              name="close"
              decorative
              color={colors.content.secondary}
              size="sm"
            />
          </Pressable>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            bounces={false}
          >
            <View
              style={[
                styles.icon,
                { backgroundColor: colors.surfaces.brandSubtle }
              ]}
            >
              <DesignIcon
                name="voice"
                decorative
                color={colors.content.link}
                size="lg"
              />
            </View>
            <StyledText
              variant="title"
              accessibilityRole="header"
              style={[styles.title, { color: colors.content.primary }]}
            >
              {translate('voice.processingConsent.title')}
            </StyledText>
            {failed ? (
              <StyledText
                accessibilityRole="alert"
                style={{ color: colors.status.danger }}
              >
                voice.processingConsent.error
              </StyledText>
            ) : null}
            <View style={styles.actions}>
              <ActionButton
                label={
                  granted
                    ? 'voice.processingConsent.withdraw'
                    : 'voice.processingConsent.accept'
                }
                loading={busy}
                onPress={onConfirm}
                style={styles.action}
              />
              <ActionButton
                label="voice.processingConsent.decline"
                variant="quiet"
                disabled={busy}
                onPress={onManual}
                style={styles.action}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '100%',
    borderRadius: 28,
    padding: 24,
    paddingTop: 32
  },
  close: {
    position: 'absolute',
    top: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  scroll: { flexGrow: 0 },
  content: { alignItems: 'center', gap: 20 },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: { textAlign: 'center', fontSize: 20, lineHeight: 30 },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 4 },
  action: { borderRadius: 16 }
});
