import {
  Platform,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';

interface RenderedLayoutNode {
  parent: RenderedLayoutNode | null;
  props: { style?: StyleProp<ViewStyle & TextStyle> };
}

export function nativeLayoutDirection(node: RenderedLayoutNode): 'ltr' | 'rtl' {
  for (
    let ancestor: RenderedLayoutNode | null = node;
    ancestor;
    ancestor = ancestor.parent
  ) {
    const direction = StyleSheet.flatten(ancestor.props.style)?.direction;
    if (direction === 'rtl' || direction === 'ltr') return direction;
  }
  return 'ltr';
}

/** Model installed Fabric's paragraph alignment, not TextInput's native path. */
export function nativeTextAlignment(node: RenderedLayoutNode) {
  const style = StyleSheet.flatten(node.props.style) ?? {};
  const alignment = style.textAlign ?? 'auto';
  if (alignment === 'auto') {
    return style.writingDirection === 'rtl' ||
      (style.writingDirection !== 'ltr' &&
        nativeLayoutDirection(node) === 'rtl')
      ? 'right'
      : 'left';
  }
  // RCTAttributedTextUtils.mm swaps explicit Left/Right for RTL Yoga Text nodes.
  if (Platform.OS === 'ios' && nativeLayoutDirection(node) === 'rtl') {
    if (alignment === 'right') return 'left';
    if (alignment === 'left') return 'right';
  }
  return alignment;
}

export function nearestStyledAncestor(
  node: RenderedLayoutNode,
  property: keyof ViewStyle
): RenderedLayoutNode {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (StyleSheet.flatten(ancestor.props.style)?.[property] !== undefined)
      return ancestor;
  }
  throw new Error(`No ancestor owns ${property}`);
}

export function nativeRowFlow(node: RenderedLayoutNode) {
  const reversed =
    StyleSheet.flatten(node.props.style)?.flexDirection === 'row-reverse';
  return (nativeLayoutDirection(node) === 'rtl') !== reversed ? 'rtl' : 'ltr';
}

/** Yoga column cross-axis start/end already follows its layout direction. */
export function nativeColumnEdge(
  node: RenderedLayoutNode,
  alignment: ViewStyle['alignItems'] | ViewStyle['alignSelf']
) {
  if (alignment === 'center') return 'center';
  if (alignment !== 'flex-start' && alignment !== 'flex-end') {
    throw new Error(`Expected an explicitly aligned column, received ${alignment}`);
  }
  const startsOnRight = nativeLayoutDirection(node) === 'rtl';
  return (alignment === 'flex-start') === startsOnRight ? 'right' : 'left';
}
