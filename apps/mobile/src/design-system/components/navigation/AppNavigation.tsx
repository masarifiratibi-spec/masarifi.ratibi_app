import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { DesignIcon } from '@/design-system/icons';
import type { LayoutDirection } from '@/domain/foundation';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function AppBar({
  title,
  onBack,
  onOverflow,
  direction = 'ltr'
}: {
  title: string;
  onBack: () => void;
  onOverflow: () => void;
  direction?: LayoutDirection;
}) {
  const theme = useTheme();
  const backLabel = translate('appShell.navigation.back');
  const moreLabel = translate('designSystem.navigation.moreOptions');
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={styles.action}
      >
        <DesignIcon
          name="back"
          label={backLabel}
          direction={direction}
          color={theme.colors.primary}
          decorative
        />
      </Pressable>
      <StyledText accessible={false} style={styles.title}>
        {title}
      </StyledText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={moreLabel}
        onPress={onOverflow}
        style={styles.action}
      >
        <DesignIcon
          name="more"
          label={moreLabel}
          color={theme.colors.primary}
          decorative
        />
      </Pressable>
    </View>
  );
}

export function ContextMenu({
  items
}: {
  items: { label: string; onPress: () => void }[];
}) {
  return (
    <View style={styles.menu}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          accessibilityLabel={item.label}
          accessibilityRole="menuitem"
          onPress={item.onPress}
          style={styles.menuItem}
        >
          <StyledText accessible={false}>{item.label}</StyledText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 44
  },
  title: {
    flex: 1,
    fontWeight: '700'
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48
  },
  menu: {
    gap: 8
  },
  menuItem: {
    justifyContent: 'center',
    minHeight: 48
  }
});
