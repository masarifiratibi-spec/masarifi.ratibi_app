import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions
} from 'react-native';
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
import { LogoutRecoveryPanel } from './LogoutRecoveryPanel';
import { RegistrationLegalPreview } from '@/features/legal/RegistrationLegalPreview';
import { getLegalDocument } from '@/features/legal/legal-documents';
import { editorialFontFamilyForLocale } from '@/design-system/typography';

export function GoogleAuthScreen({
  mode = 'welcome'
}: { mode?: 'welcome' | 'sign-in' } = {}) {
  const identity = useLiveIdentityStatus();
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const { height } = useWindowDimensions();
  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: theme.colors.surfaces.page }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing.xl, direction }
        ]}
      >
        <LogoutRecoveryPanel />
        <View
          style={[
            styles.intro,
            {
              paddingTop: height < 740 ? 0 : theme.spacing.lg
            }
          ]}
        >
          <Image
            accessible
            source={require('../../../assets/icon.png')}
            accessibilityRole="image"
            accessibilityLabel={translate('googleAuth.brand')}
            style={styles.mark}
          />
          <StyledText
            variant="headline"
            style={{
              textAlign: 'center',
              writingDirection: direction,
              marginTop: theme.spacing.xxl,
              fontFamily: editorialFontFamilyForLocale(locale, 600),
              fontWeight: '600'
            }}
          >
            {translate('googleAuth.welcome')}
          </StyledText>
          <StyledText
            style={{
              textAlign: 'center',
              writingDirection: direction,
              color: theme.colors.content.secondary,
              fontFamily: editorialFontFamilyForLocale(locale, 400),
              marginTop: theme.spacing.sm
            }}
          >
            {translate('googleAuth.supporting')}
          </StyledText>
        </View>
        <View
          style={{
            gap: theme.spacing.md,
            marginTop: theme.spacing.xxl + theme.spacing.lg
          }}
        >
          {mode === 'welcome' ? <RegistrationLegalPreview /> : null}
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
              color: theme.colors.content.secondary,
              fontFamily: editorialFontFamilyForLocale(locale, 400)
            }}
          >
            {translate('googleAuth.footer')}
          </StyledText>
        </View>
        {mode === 'sign-in' ? (
          <View
            testID="sign-in-documents"
            style={[
              styles.documents,
              { paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.xl }
            ]}
          >
            {(['terms', 'privacy'] as const).map((document) => (
              <Pressable
                key={document}
                accessibilityRole="button"
                accessibilityLabel={getLegalDocument(locale, document).title}
                onPress={() => router.push(`/legal?document=${document}`)}
                style={{
                  minHeight: theme.minTouchTarget,
                  justifyContent: 'center'
                }}
              >
                <StyledText
                  variant="caption"
                  style={{
                    color: theme.colors.content.link,
                    fontFamily: editorialFontFamilyForLocale(locale, 400),
                    textDecorationLine: 'underline'
                  }}
                >
                  {getLegalDocument(locale, document).title}
                </StyledText>
              </Pressable>
            ))}
          </View>
        ) : null}
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
    justifyContent: 'center',
    gap: 0
  },
  intro: { alignItems: 'center' },
  mark: { width: 80, height: 80, borderRadius: 24 },
  documents: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 24
  }
});
