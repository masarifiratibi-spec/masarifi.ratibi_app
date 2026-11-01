import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { AssistantBotAvatar } from './AssistantBotAvatar';
import { useTheme } from '@/state/theme-context';
import { layoutDirectionStyle } from '@/design-system/direction';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import {
  currentLocale,
  translate,
  translateDynamic
} from '@/localization/i18n';
import { fontFamilyForLocale } from '@/design-system/typography';
import { usePreferenceStore } from '@/state/preferences';
import { spacing } from '@/design-system/tokens';
import type { AssistantResponse } from '@/domain/assistant';
import { colorTokens } from '@/design-system/tokens';
import { useAssistantFinancialVisibility } from '../useAssistantFinancialVisibility';

export interface AssistantMessageBubbleProps {
  response: AssistantResponse;
  conversationId?: string;
  onReviewAction?: (previewId: string) => void;
  renderAction?: (previewId: string, fallback: React.ReactNode) => React.ReactNode;
  onViewReport?: () => void;
  onFeedback?: (feedback: 'helpful' | 'not_helpful' | 'reported') => void;
  timestamp?: string;
  testID?: string;
}

export function AssistantMessageBubble({
  response,
  conversationId: _conversationId,
  onReviewAction,
  renderAction,
  onViewReport,
  onFeedback,
  timestamp,
  testID = 'assistant-message-bubble'
}: AssistantMessageBubbleProps) {
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';
  const { hidden, reveal } = useAssistantFinancialVisibility(response.id);
  const { colors, typography } = useTheme();
  const inlineActions = Boolean(renderAction && response.proposedActionIds?.length);
  const numberParts = (text: string, prefix: string) =>
    text
      .split(/([+\-−]?\p{N}+(?:[.,٫٬]\p{N}+)*(?:[%٪])?)/gu)
      .map((part, index) =>
        index % 2 === 1 ? (
          <Text
            key={`${prefix}-${index}`}
            style={{
              fontSize: typography.subtitle.fontSize,
              fontWeight: '600',
              fontFamily: fontFamilyForLocale(currentLocale(), 600),
              fontVariant: ['tabular-nums']
            }}
          >
            {part}
          </Text>
        ) : (
          part
        )
      );

  const textBlocks = (response.blocks ?? []).map((block, index) => (
    <View
      key={block.key ?? `${response.id}-block-${index}`}
      style={styles.block}
    >
      {block.label && response.blocks.length > 1 && (
        <StyledText
          style={[styles.blockLabel, { color: colors.content.secondary }]}
        >
          {translate(`assistant.label.${block.label}`)}
        </StyledText>
      )}
      <StyledText
        style={[
          styles.blockText,
          { color: colors.content.primary },
          {
            textAlign: isRtl ? 'right' : 'left',
            writingDirection: direction
          }
        ]}
      >
        {hidden
          ? '••••'
          : translateDynamic(block.key, block.values)
              .replace(/\uFFFC/gu, '')
              .split(/(\*\*[^*\r\n]+\*\*)/g)
              .map((part, partIndex) =>
                partIndex % 2 === 1 ? (
                  <Text
                    key={partIndex}
                    style={{
                      fontWeight: '700',
                      fontFamily: fontFamilyForLocale(currentLocale(), 700)
                    }}
                  >
                    {numberParts(part.slice(2, -2), `${index}-${partIndex}`)}
                  </Text>
                ) : (
                  numberParts(part, `${index}-${partIndex}`)
                )
              )}
      </StyledText>
    </View>
  ));

  return (
    <View
      testID={testID}
      style={[
        styles.row,
        {
          flexDirection: isRtl ? 'row-reverse' : 'row'
        }
      ]}
    >
      {/* Bot Avatar */}
      <AssistantBotAvatar
        size={34}
        testID="assistant-message-avatar"
        style={styles.avatar}
      />

      {/* Bubble Card */}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.surfaces.card,
            borderColor: colors.borders.default
          },
          isRtl ? styles.bubbleRtl : styles.bubbleLtr
        ]}
      >
        {/* Response Blocks */}
        {!inlineActions ? textBlocks : null}

        {/* Evidence Report Link */}
        {response.snapshot?.reportReference && onViewReport && !hidden && (
          <ActionButton
            label={translate('assistant.evidence.report')}
            variant="secondary"
            onPress={onViewReport}
          />
        )}

        {hidden && !inlineActions ? (
          <ActionButton
            label="assistant.action.revealFinancial"
            variant="secondary"
            onPress={reveal}
          />
        ) : null}

        {/* Proposed Actions */}
        {(response.proposedActionIds ?? []).map((previewId) => renderAction ? <React.Fragment key={previewId}>{renderAction(previewId, textBlocks)}</React.Fragment> : (
          <ActionButton
            key={previewId}
            label={translate('assistant.proposal.review')}
            variant="primary"
            onPress={() => onReviewAction?.(previewId)}
          />
        ))}

        {/* Limitations Notice */}
        {!inlineActions && (response.limitations ?? []).map((item) => (
          <StyledText key={item} style={styles.limitationText}>
            {item === 'review_required_excluded'
              ? translate('assistant.limitation.reviewExcluded')
              : translateDynamic(`assistant.limitation.${item}`) ===
                  `assistant.limitation.${item}`
                ? translateDynamic('assistant.limitation.data_incomplete')
                : translateDynamic(`assistant.limitation.${item}`)}
          </StyledText>
        ))}

        {/* Footer with Timestamp & Feedback */}
        <View
          style={[
            styles.footer,
            { flexDirection: isRtl ? 'row-reverse' : 'row' }
          ]}
        >
          {timestamp && (
            <StyledText style={styles.timestamp}>{timestamp}</StyledText>
          )}

          {onFeedback && !inlineActions && (
            <View
              style={[
                styles.feedbackRow,
                { flexDirection: isRtl ? 'row-reverse' : 'row' }
              ]}
            >
              <Pressable
                onPress={() => onFeedback('helpful')}
                style={styles.feedbackBtn}
                accessibilityLabel={translate('assistant.feedback.helpful')}
              >
                <Text style={styles.feedbackEmoji}>👍</Text>
              </Pressable>
              <Pressable
                onPress={() => onFeedback('not_helpful')}
                style={styles.feedbackBtn}
                accessibilityLabel={translateDynamic(
                  'assistant.feedback.notHelpful'
                )}
              >
                <Text style={styles.feedbackEmoji}>👎</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    ...layoutDirectionStyle('ltr'),
    gap: spacing.xs,
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    width: '100%'
  },
  avatar: {
    marginTop: 4
  },
  bubble: {
    backgroundColor: colorTokens.raw['FFFFFF'],
    borderColor: colorTokens.raw['D7E1DC'],
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colorTokens.raw['103F37'],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  bubbleRtl: {
    borderTopLeftRadius: 4
  },
  bubbleLtr: {
    borderTopRightRadius: 4
  },
  block: {
    gap: 2
  },
  blockLabel: {
    color: colorTokens.raw['0D684A'],
    fontSize: 11,
    fontWeight: '700'
  },
  blockText: {
    color: colorTokens.raw['10231F']
  },
  limitationText: {
    color: colorTokens.raw['657872'],
    fontSize: 11.5,
    fontStyle: 'italic'
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: 4
  },
  timestamp: {
    color: colorTokens.raw['7C8B85'],
    fontSize: 11
  },
  feedbackRow: {
    alignItems: 'center',
    gap: spacing.xs
  },
  feedbackBtn: {
    padding: 2
  },
  feedbackEmoji: {
    fontSize: 13
  }
});
