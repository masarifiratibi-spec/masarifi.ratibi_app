import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledText } from '@/components/StyledText';
import { GoogleAccountSelector } from './GoogleAccountSelector';
import { authService } from './auth-flow';
import { completeAuthenticatedSession } from './session-controller';
import { router } from 'expo-router';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useLiveIdentityStatus } from '@/services/live/clerk-context';
import { ActionButton } from '@/design-system/components/ActionButton';

export function GoogleAuthScreen() {
  const identity = useLiveIdentityStatus();
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: theme.colors.surfaces.page }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing.lg, direction }
        ]}
      >
        <View style={[styles.languages, { gap: theme.spacing.sm }]}>
          {(['ar', 'en'] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: locale === option }}
              onPress={() => {
                void usePreferenceStore.getState().setLocale(option);
              }}
              style={{
                minHeight: theme.minTouchTarget,
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.md
              }}
            >
              <StyledText
                style={{
                  color:
                    locale === option
                      ? theme.colors.primary
                      : theme.colors.content.secondary
                }}
              >
                {translate(`firstLaunch.language.${option}`)}
              </StyledText>
            </Pressable>
          ))}
        </View>
        <View style={[styles.intro, { gap: theme.spacing.md }]}>
          <Image
            accessible
            source={require('../../../assets/icon.png')}
            accessibilityRole="image"
            accessibilityLabel={translate('googleAuth.brand')}
            style={styles.mark}
          />
          <StyledText
            variant="headline"
            style={{ textAlign: 'center', writingDirection: direction }}
          >
            {translate('googleAuth.brand')}
          </StyledText>
          <StyledText
            variant="subtitle"
            style={{ textAlign: 'center', writingDirection: direction }}
          >
            {translate('googleAuth.welcome')}
          </StyledText>
          <StyledText
            style={{
              textAlign: 'center',
              writingDirection: direction,
              color: theme.colors.content.secondary
            }}
          >
            {translate('googleAuth.supporting')}
          </StyledText>
        </View>
        <View
          style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
        >
          <GoogleAccountSelector
            label={translate('googleAuth.continue')}
            signIn={() => authService.signInWithGoogle()}
            loading={identity.status === 'sso'}
            disabled={identity.status === 'loading'}
            lifecycleMessage={
              identity.status === 'cancelled'
                ? 'appShell.auth.google.cancelled'
                : identity.status === 'incomplete'
                  ? 'googleAuth.incomplete'
                  : identity.status === 'error'
                    ? 'appShell.error.unknown'
                    : undefined
            }
            onResult={async (result) => {
              if (result.status !== 'authenticated') return;
              await usePreferenceStore
                .getState()
                .completeFirstLaunchOnboarding();
              router.replace(
                await completeAuthenticatedSession(result.session)
              );
            }}
          />
          {identity.status === 'loading' ? (
            <StyledText accessibilityLiveRegion="polite">
              {translate('appShell.state.loading')}
            </StyledText>
          ) : null}
          {identity.status === 'error' ? (
            <ActionButton
              label={translate('profileSetup.retry')}
              variant="quiet"
              onPress={identity.retry}
            />
          ) : null}
          <StyledText
            variant="caption"
            style={{
              textAlign: 'center',
              writingDirection: direction,
              color: theme.colors.content.secondary
            }}
          >
            {translate('googleAuth.footer')}
          </StyledText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'space-between',
    gap: 32
  },
  languages: { flexDirection: 'row', alignSelf: 'flex-end' },
  intro: { alignItems: 'center', paddingVertical: 32 },
  mark: { width: 88, height: 88, borderRadius: 24 }
});
