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
import { useLiveIdentityStatus } from '@/services/live/clerk-context';
import { ActionButton } from '@/design-system/components/ActionButton';
import { LogoutRecoveryPanel } from './LogoutRecoveryPanel';
import { RegistrationLegalPreview } from '@/features/legal/RegistrationLegalPreview';
import { getLegalDocument } from '@/features/legal/legal-documents';
import { editorialFontFamilyForLocale } from '@/design-system/typography';
import { colorTokens } from '@/design-system/tokens';
import { layoutDirectionStyle } from '@/design-system/direction';

export function GoogleAuthScreen({
  mode = 'welcome'
}: { mode?: 'welcome' | 'sign-in' } = {}) {
  const identity = useLiveIdentityStatus();
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const { height } = useWindowDimensions();
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.fill, { backgroundColor: colorTokens.auth.surface }]}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.content, layoutDirectionStyle(direction)]}
      >
        <LogoutRecoveryPanel />
        <Image
          accessible={false}
          source={require('../../../assets/auth/saudi-courtyard.png')}
          resizeMode="cover"
          style={[styles.hero, { height: Math.min(480, height * 0.52) }]}
        />
        <View style={styles.body}>
          <View style={styles.intro}>
            <StyledText
              variant="headline"
              accessibilityLabel={translate('googleAuth.welcome').replace(
                /\n/g,
                ' '
              )}
              style={[
                styles.title,
                {
                  writingDirection: direction,
                  textAlign: 'auto',
                  fontFamily: editorialFontFamilyForLocale(locale, 600),
                  color: colorTokens.auth.content
                }
              ]}
            >
              {translate('googleAuth.welcome')}
            </StyledText>
            <StyledText
              style={[
                styles.supporting,
                {
                  writingDirection: direction,
                  textAlign: 'auto',
                  color: colorTokens.auth.secondary,
                  fontFamily: editorialFontFamilyForLocale(locale, 400)
                }
              ]}
            >
              {translate('googleAuth.supporting')}
            </StyledText>
          </View>
          <View style={styles.actions}>
            {mode === 'welcome' ? <RegistrationLegalPreview /> : null}
            <GoogleAccountSelector
              label={translate('googleAuth.continue')}
              signIn={() => authService.signInWithGoogle()}
              loading={identity.status === 'sso'}
              disabled={identity.status === 'loading'}
              buttonStyle={[
                styles.googleButton,
                { borderColor: colorTokens.auth.content }
              ]}
              labelStyle={{
                color: colorTokens.auth.content,
                fontFamily: editorialFontFamilyForLocale(locale, 600),
                writingDirection: direction,
                textAlign: 'center',
                fontSize: 16
              }}
              messageStyle={{
                color: colorTokens.auth.content,
                writingDirection: direction,
                textAlign: 'auto'
              }}
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
              <StyledText
                accessibilityLiveRegion="polite"
                style={{
                  color: colorTokens.auth.secondary,
                  writingDirection: direction,
                  textAlign: 'auto'
                }}
              >
                {translate('appShell.state.loading')}
              </StyledText>
            ) : null}
            {identity.status === 'error' ? (
              <ActionButton
                label={translate('profileSetup.retry')}
                variant="quiet"
                labelStyle={{ color: colorTokens.auth.content }}
                onPress={identity.retry}
              />
            ) : null}
          </View>
          <View style={styles.bottomSpace} />

          {mode === 'sign-in' ? (
            <View testID="sign-in-documents" style={styles.documents}>
              {(['terms', 'privacy'] as const).map((document) => (
                <Pressable
                  key={document}
                  accessibilityRole="button"
                  accessibilityLabel={getLegalDocument(locale, document).title}
                  onPress={() => router.push(`/legal?document=${document}`)}
                  style={styles.documentLink}
                >
                  <StyledText
                    variant="caption"
                    style={[
                      styles.legalText,
                      {
                        color: colorTokens.auth.content,
                        writingDirection: direction,
                        fontFamily: editorialFontFamilyForLocale(locale, 400),
                        textDecorationLine: 'underline'
                      }
                    ]}
                  >
                    {getLegalDocument(locale, document).title}
                  </StyledText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  hero: { width: '100%' },
  body: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 8,
    marginTop: -24
  },
  intro: { alignItems: 'stretch' },
  title: { fontSize: 32, lineHeight: 46, fontWeight: '600' },
  supporting: { fontSize: 17, lineHeight: 28, marginTop: 16 },
  actions: { width: '100%', gap: 16, marginTop: 24 },
  googleButton: { minHeight: 56, borderRadius: 16 },
  bottomSpace: { flexGrow: 1, minHeight: 24 },
  documents: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 24
  },
  documentLink: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
  legalText: { fontSize: 13, lineHeight: 24, textAlign: 'center' }
});
