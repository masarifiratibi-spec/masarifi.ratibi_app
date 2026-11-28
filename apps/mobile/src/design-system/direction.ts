import {
  Platform,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';

type DirectionalLayoutStyle = ViewStyle &
  Pick<TextStyle, 'writingDirection'>;

export function layoutDirectionStyle(
  direction: 'ltr' | 'rtl'
): DirectionalLayoutStyle {
  return Platform.OS === 'web'
    ? { writingDirection: direction }
    : { direction };
}

/** Keep physical alignment stable while iOS Fabric mirrors RTL paragraphs. */
export function iosTextLayoutStyle(
  direction: 'ltr' | 'rtl',
  style?: StyleProp<TextStyle>
): TextStyle | undefined {
  if (Platform.OS !== 'ios') return undefined;
  const requested = StyleSheet.flatten(style);
  return {
    // Fabric swaps explicit left/right alignment for an RTL Yoga text node.
    direction: 'ltr',
    writingDirection:
      requested?.writingDirection && requested.writingDirection !== 'auto'
        ? requested.writingDirection
        : direction,
    textAlign:
      requested?.textAlign && requested.textAlign !== 'auto'
        ? requested.textAlign
        : direction === 'rtl'
          ? 'right'
          : 'left'
  };
}

export function leadingTextStyle(direction: 'ltr' | 'rtl'): TextStyle {
  // Android resolves alignment relative to the paragraph's layout direction.
  return {
    ...layoutDirectionStyle(direction),
    writingDirection: direction,
    textAlign: Platform.OS === 'android' ? 'auto' : direction === 'rtl' ? 'right' : 'left'
  };
}
