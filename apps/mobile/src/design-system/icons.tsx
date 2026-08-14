import React from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { LayoutDirection } from '@/domain/foundation';
import { iconSize } from './tokens';

export const directionalIconNames = [
  'back',
  'forward',
  'chevronStart',
  'chevronEnd'
] as const;

export type DesignIconName =
  | (typeof directionalIconNames)[number]
  | 'search'
  | 'settings'
  | 'close'
  | 'check'
  | 'warning'
  | 'info'
  | 'add'
  | 'more'
  | 'home'
  | 'transactions'
  | 'reports'
  | 'accounts'
  | 'profile'
  | 'security'
  | 'tracking'
  | 'signOut';

type IconSize = keyof typeof iconSize;

const iconMap: Record<DesignIconName, keyof typeof Ionicons.glyphMap> = {
  back: 'arrow-back',
  forward: 'arrow-forward',
  chevronStart: 'chevron-back',
  chevronEnd: 'chevron-forward',
  search: 'search',
  settings: 'settings-outline',
  close: 'close',
  check: 'checkmark',
  warning: 'warning-outline',
  info: 'information-circle-outline',
  add: 'add',
  more: 'ellipsis-horizontal',
  home: 'home-outline',
  transactions: 'swap-horizontal-outline',
  reports: 'bar-chart-outline',
  accounts: 'wallet-outline',
  profile: 'person-outline',
  security: 'shield-checkmark-outline',
  tracking: 'radio-outline',
  signOut: 'log-out-outline'
};

const directionalIconSet = new Set<DesignIconName>(directionalIconNames);

export interface DesignIconProps {
  name: DesignIconName;
  label: string;
  size?: IconSize;
  color?: string;
  direction?: LayoutDirection;
  testID?: string;
  style?: StyleProp<TextStyle>;
  decorative?: boolean;
}

export function DesignIcon({
  name,
  label,
  size = 'md',
  color,
  direction = 'ltr',
  testID,
  style,
  decorative = false
}: DesignIconProps) {
  const shouldMirror = direction === 'rtl' && directionalIconSet.has(name);

  return (
    <Ionicons
      testID={testID}
      name={iconMap[name]}
      size={iconSize[size]}
      color={color}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : label}
      accessibilityRole={decorative ? undefined : 'image'}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[shouldMirror && { transform: [{ scaleX: -1 }] }, style]}
    />
  );
}
