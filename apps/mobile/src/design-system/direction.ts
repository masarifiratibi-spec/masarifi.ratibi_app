import { Platform, type TextStyle, type ViewStyle } from 'react-native';

type DirectionalLayoutStyle = ViewStyle &
  Pick<TextStyle, 'writingDirection'>;

export function layoutDirectionStyle(
  direction: 'ltr' | 'rtl'
): DirectionalLayoutStyle {
  return Platform.OS === 'web'
    ? { writingDirection: direction }
    : { direction };
}
