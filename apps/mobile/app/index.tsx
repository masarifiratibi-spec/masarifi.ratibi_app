/**
 * Foundation validation menu.
 *
 * Temporary entry route listing the four validation harness routes. This is
 * NOT a production dashboard; each route proves one foundation contract. Scope
 * Contract §11 prohibits production screens in this feature.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { useTheme } from '@/state/theme-context';
import { translate } from '@/localization/i18n';
import { StyledText } from '@/components/StyledText';
import { MenuLink } from '@/components/MenuLink';
import type { MessageKey } from '@/localization/messages/en';

const ROUTES: readonly { href: string; titleKey: MessageKey }[] = [
  { href: '/foundation/position', titleKey: 'nav.position' },
  { href: '/foundation/capture', titleKey: 'nav.capture' },
  { href: '/foundation/trust', titleKey: 'nav.trust' },
  { href: '/foundation/accessibility', titleKey: 'nav.accessibility' }
];

export default function ValidationMenu() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <StyledText variant="title" style={styles.title}>
        {translate('app.foundationTitle')}
      </StyledText>
      <StyledText variant="body" style={styles.intro}>
        {translate('app.foundationIntro')}
      </StyledText>

      <View style={styles.list}>
        {ROUTES.map((route) => (
          <Link key={route.href} href={route.href} asChild>
            <MenuLink label={translate(route.titleKey)} />
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: 16,
    gap: 12
  },
  title: {
    marginTop: 8
  },
  intro: {
    marginBottom: 8
  },
  list: {
    gap: 8
  }
});
