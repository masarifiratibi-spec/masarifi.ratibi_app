import React, { useCallback } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';

import { isFixtureModeEnabled } from '@/config/demo-mode';
import { spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';
import {
  readSocialMediaLinks,
  socialMediaLinksSchema,
  type SocialMediaLinksValue
} from '@/services/live/social-media-service';
import { socialMediaBrandPaths } from './social-media-brand-paths';

const platforms = [
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['snapchat', 'Snapchat']
] as const;

export function SocialMediaLinks({ links }: { links: SocialMediaLinksValue }) {
  const theme = useTheme();
  const visible = platforms.filter(
    ([key]) =>
      links[key] !== '' &&
      socialMediaLinksSchema.shape[key].safeParse(links[key]).success
  );
  if (!visible.length) return null;
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(translate('settings.socialMedia.openError'));
    }
  };
  return (
    <View style={styles.row}>
      {visible.map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole="link"
          accessibilityLabel={label}
          onPress={() => void open(links[key])}
          style={({ pressed }) => [styles.icon, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {key === 'instagram' ? (
              <>
                <Rect
                  x={3}
                  y={3}
                  width={18}
                  height={18}
                  rx={5}
                  fill="none"
                  stroke={theme.colors.content.secondary}
                  strokeWidth={1.8}
                />
                <Circle
                  cx={12}
                  cy={12}
                  r={4}
                  fill="none"
                  stroke={theme.colors.content.secondary}
                  strokeWidth={1.8}
                />
                <Circle
                  cx={17.5}
                  cy={6.5}
                  r={1.1}
                  fill={theme.colors.content.secondary}
                />
              </>
            ) : (
              <Path
                d={socialMediaBrandPaths[key]}
                fill={theme.colors.content.secondary}
              />
            )}
          </Svg>
        </Pressable>
      ))}
    </View>
  );
}

export function SocialMediaFooter() {
  const live = !isFixtureModeEnabled();
  const { data, refetch, isError } = useQuery({
    queryKey: ['settings', 'social-media-links'],
    queryFn: ({ signal }) => readSocialMediaLinks(signal),
    enabled: live,
    retry: false,
    staleTime: 0
  });
  useFocusEffect(
    useCallback(() => {
      if (live) void refetch();
    }, [live, refetch])
  );
  return data && !isError ? <SocialMediaLinks links={data} /> : null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg
  },
  icon: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
