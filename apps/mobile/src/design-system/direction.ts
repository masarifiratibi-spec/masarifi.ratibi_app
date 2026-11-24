import { Platform, type TextStyle, type ViewStyle } from 'react-native';

type DirectionalLayoutStyle = ViewStyle &
  Pick<TextStyle, 'writingDirection'>;

export function leadingTextStyle(direction: 'ltr' | 'rtl'): TextStyle {
  // Android resolves alignment relative to the paragraph's layout direction.
  return {
    ...layoutDirectionStyle(direction),
    writingDirection: direction,
    textAlign: Platform.OS === 'android' ? 'auto' : direction === 'rtl' ? 'right' : 'left'
  };
}

export function layoutDirectionStyle(
  direction: 'ltr' | 'rtl'
): DirectionalLayoutStyle {
  return Platform.OS === 'web'
    ? { writingDirection: direction }
    : { direction };
}
