import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { layoutDirectionStyle } from '@/design-system/direction';
import { StyledText } from '@/components/StyledText';
import { usePreferenceStore } from '@/state/preferences';
import { spacing } from '@/design-system/tokens';
import { colorTokens } from '@/design-system/tokens';

export interface UserMessageBubbleProps {
  message: string;
  timestamp?: string;
  testID?: string;
}

export function UserMessageBubble({
  message,
  timestamp,
  testID = 'user-message-bubble'
}: UserMessageBubbleProps) {
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  return (
    <View
      testID={testID}
      style={[
        styles.row,
        {
          justifyContent: 'flex-end'
        }
      ]}
    >
      <View
        style={[
          styles.bubble,
          isRtl ? styles.bubbleRtl : styles.bubbleLtr
        ]}
      >
        <StyledText
          style={[
            styles.messageText,
            {
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {message}
        </StyledText>

        <View
          style={[
            styles.footer,
            { flexDirection: isRtl ? 'row-reverse' : 'row' }
          ]}
        >
          {timestamp && (
            <StyledText style={styles.timestamp}>{timestamp}</StyledText>
          )}
          <Text style={styles.checkmarks}>✓✓</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    width: '100%'
  },
  bubble: {
    backgroundColor: colorTokens.raw["D7EFE6"],
    borderColor: colorTokens.raw["C0E5D7"],
    borderRadius: 22,
    borderWidth: 1,
    gap: 4,
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  bubbleRtl: {
    borderTopRightRadius: 4
  },
  bubbleLtr: {
    borderTopLeftRadius: 4
  },
  messageText: {
    color: colorTokens.raw["10231F"],
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 20
  },
  footer: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    ...layoutDirectionStyle('ltr'),
    gap: 4,
    marginTop: 2
  },
  timestamp: {
    color: colorTokens.raw["657872"],
    fontSize: 11
  },
  checkmarks: {
    color: colorTokens.raw["10B981"],
    fontSize: 11,
    fontWeight: '700'
  }
});
