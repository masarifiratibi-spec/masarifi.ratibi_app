import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { router } from 'expo-router';

import { layoutDirectionStyle } from '@/design-system/direction';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import { DesignIcon, type DesignIconName } from '@/design-system/icons';
import { radius, spacing } from '@/design-system/tokens';
import type { SupportDraftInput } from '@/domain/support';
import { translate, translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useSaveSupportDraft, useSubmitSupportDraft } from './support-queries';
import { useSupportDraft } from './useSupportDraft';
import { colorTokens } from '@/design-system/tokens';

export type SupportFormMode = SupportDraftInput['mode'];

const categoryIcons: Record<string, DesignIconName> = {
  technical: 'settings',
  privacy: 'privacy',
  account: 'profile',
  feedback: 'feedback'
};

export function SupportFormScreen({
  mode = 'ticket',
  context = null
}: {
  mode?: SupportFormMode;
  context?: SupportDraftInput['context'];
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';
  const draftId = useMemo(() => `support-draft-${mode}`, [mode]);
  const draft = useSupportDraft({ draftId, mode, initialContext: context });
  const save = useSaveSupportDraft();
  const submit = useSubmitSupportDraft();
  const [subject, setSubject] = useState(draft.values.subject);
  const [description, setDescription] = useState(draft.values.description);
  const [showSubjectError, setShowSubjectError] = useState(false);
  const [showDescriptionError, setShowDescriptionError] = useState(false);

  const categories = ['technical', 'privacy', 'account', 'feedback'] as const;
  const isPending = save.isPending || submit.isPending;

  useEffect(() => {
    setSubject(draft.values.subject);
    setDescription(draft.values.description);
  }, [draft.values.description, draft.values.subject]);

  async function submitDraft() {
    if (!subject.trim()) {
      setShowSubjectError(true);
      return;
    }
    if (!description.trim()) {
      setShowDescriptionError(true);
      return;
    }
    await save.mutateAsync({
      ...draft.values,
      id: draftId,
      mode,
      subject,
      description
    } as SupportDraftInput);
    submit.mutate(
      { draftId, operationId: `support-submit-${Date.now()}` },
      { onSuccess: () => draft.markSubmitted?.() }
    );
  }

  const backLabel = translate('appShell.navigation.back');

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContainer,
        { backgroundColor: theme.colors.surfaces.page }
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <DesignIcon
            name="back"
            label={backLabel}
            direction={direction}
            color={theme.colors.primary}
            decorative
          />
        </Pressable>
        <StyledText accessible={false} style={styles.topBarTitle}>
          {translateDynamic('support.home.title')}
        </StyledText>
        <View style={styles.backButton} />
      </View>

      {/* Screen Title & Subtitle */}
      <View
        style={[
          styles.heroHeader,
          { alignItems: isRtl ? 'flex-end' : 'flex-start' }
        ]}
      >
        <StyledText style={styles.heroTitle} variant="title">
          {translateDynamic('support.form.title')}
        </StyledText>
        <StyledText
          style={[styles.heroSubtitle, { color: theme.colors.content.secondary }]}
          variant="caption"
        >
          {translateDynamic('support.form.subtitle')}
        </StyledText>
      </View>

      {/* Main Content Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }
        ]}
      >
        {/* Context attachments if any */}
        {draft.values.context?.itemKind === 'transaction' ? (
          <StyledText style={{ color: theme.colors.content.secondary }}>
            {translateDynamic('support.form.context.transaction')}
          </StyledText>
        ) : null}
        {draft.values.context?.itemKind === 'assistant_response' ? (
          <StyledText style={{ color: theme.colors.content.secondary }}>
            {translateDynamic('support.form.context.assistant')}
          </StyledText>
        ) : null}
        {draft.values.context ? (
          <ActionButton
            label="support.form.removeContext"
            variant="secondary"
            onPress={() => draft.update({ context: null })}
          />
        ) : null}

        {/* Categories Section */}
        <View style={styles.sectionGroup}>
          <StyledText
            accessible={false}
            style={[
              styles.sectionLabel,
              {
                color: theme.colors.content.primary,
                textAlign: isRtl ? 'right' : 'left'
              }
            ]}
          >
            {translateDynamic('support.form.category')}
          </StyledText>
          <View
            testID="chip-selector"
            style={[
              styles.chipsContainer,
              { flexDirection: isRtl ? 'row-reverse' : 'row' }
            ]}
          >
            {categories.map((category) => {
              const isSelected = draft.values.category === category;
              const categoryLabel = translateDynamic(
                `support.category.${category}`
              );
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityLabel={`${categoryLabel} ${translate(
                    isSelected
                      ? 'designSystem.state.selected'
                      : 'designSystem.state.available'
                  )}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => draft.update({ category })}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: isSelected
                        ? theme.colors.primary
                        : theme.colors.border,
                      backgroundColor: isSelected
                        ? theme.colors.surfaceMuted
                        : theme.colors.surface,
                      opacity: pressed ? 0.85 : 1
                    }
                  ]}
                >
                  {isRtl && isSelected && (
                    <DesignIcon
                      name="checkCircle"
                      label=""
                      size="tiny"
                      color={theme.colors.primary}
                      decorative
                    />
                  )}
                  {!isRtl && (
                    <DesignIcon
                      name={categoryIcons[category]}
                      label={categoryLabel}
                      size="sm"
                      color={
                        isSelected
                          ? theme.colors.primary
                          : theme.colors.content.secondary
                      }
                      decorative
                    />
                  )}
                  <StyledText
                    accessible={false}
                    style={[
                      styles.chipText,
                      {
                        color: isSelected
                          ? theme.colors.primary
                          : theme.colors.content.primary,
                        fontWeight: isSelected ? '700' : '500'
                      }
                    ]}
                  >
                    {categoryLabel}
                  </StyledText>
                  {isRtl && (
                    <DesignIcon
                      name={categoryIcons[category]}
                      label={categoryLabel}
                      size="sm"
                      color={
                        isSelected
                          ? theme.colors.primary
                          : theme.colors.content.secondary
                      }
                      decorative
                    />
                  )}
                  {!isRtl && isSelected && (
                    <DesignIcon
                      name="checkCircle"
                      label=""
                      size="tiny"
                      color={theme.colors.primary}
                      decorative
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Subject Field */}
        <View style={styles.sectionGroup}>
          <View
            style={[
              styles.labelRow,
              { flexDirection: isRtl ? 'row-reverse' : 'row' }
            ]}
          >
            <StyledText
              accessible={false}
              style={[
                styles.sectionLabel,
                { color: theme.colors.content.primary }
              ]}
            >
              {translateDynamic('support.form.subject')}
            </StyledText>
            <StyledText
              accessible={false}
              style={[styles.asterisk, { color: theme.colors.primary }]}
            >
              {' *'}
            </StyledText>
          </View>
          <TextInput
            accessibilityLabel={translateDynamic('support.form.subject')}
            value={subject}
            onChangeText={(next) => {
              setSubject(next);
              setShowSubjectError(false);
              draft.update({ subject: next });
            }}
            placeholder={translateDynamic('support.form.subjectPlaceholder')}
            placeholderTextColor={theme.colors.content.tertiary}
            style={[
              styles.input,
              {
                borderColor: showSubjectError
                  ? theme.colors.status.danger
                  : theme.colors.border,
                color: theme.colors.content.primary,
                textAlign: isRtl ? 'right' : 'left'
              }
            ]}
          />
          {showSubjectError ? (
            <StyledText
              accessibilityRole="alert"
              style={[
                styles.errorText,
                {
                  color: theme.colors.status.danger,
                  textAlign: isRtl ? 'right' : 'left'
                }
              ]}
            >
              {translateDynamic('support.form.validation.subject')}
            </StyledText>
          ) : null}
        </View>

        {/* Description Field */}
        <View style={styles.sectionGroup}>
          <View
            style={[
              styles.labelRow,
              { flexDirection: isRtl ? 'row-reverse' : 'row' }
            ]}
          >
            <StyledText
              accessible={false}
              style={[
                styles.sectionLabel,
                { color: theme.colors.content.primary }
              ]}
            >
              {translateDynamic('support.form.description')}
            </StyledText>
            <StyledText
              accessible={false}
              style={[styles.asterisk, { color: theme.colors.primary }]}
            >
              {' *'}
            </StyledText>
          </View>
          <TextInput
            accessibilityLabel={translateDynamic('support.form.description')}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={description}
            onChangeText={(next) => {
              setDescription(next);
              setShowDescriptionError(false);
              draft.update({ description: next });
            }}
            placeholder={translateDynamic(
              'support.form.descriptionPlaceholder'
            )}
            placeholderTextColor={theme.colors.content.tertiary}
            style={[
              styles.textarea,
              {
                borderColor: showDescriptionError
                  ? theme.colors.status.danger
                  : theme.colors.border,
                color: theme.colors.content.primary,
                textAlign: isRtl ? 'right' : 'left'
              }
            ]}
          />
          {showDescriptionError ? (
            <StyledText
              accessibilityRole="alert"
              style={[
                styles.errorText,
                {
                  color: theme.colors.status.danger,
                  textAlign: isRtl ? 'right' : 'left'
                }
              ]}
            >
              {translateDynamic('support.form.validation.description')}
            </StyledText>
          ) : null}
        </View>

        {/* Draft save failure / warning notice */}
        {draft.safeFailure ? (
          <View
            style={[
              styles.warningBanner,
              {
                backgroundColor: colorTokens.raw["FFFBEB"],
                borderColor: colorTokens.raw["FDE68A"],
                flexDirection: isRtl ? 'row-reverse' : 'row'
              }
            ]}
          >
            <DesignIcon
              name="warning"
              label=""
              size="sm"
              color={colorTokens.raw["D97706"]}
              decorative
            />
            <StyledText style={[styles.warningText, { color: colorTokens.raw["92400E"] }]}>
              {translateDynamic(`support.form.failure.${draft.safeFailure}`)}
            </StyledText>
          </View>
        ) : null}
      </View>

      {/* Submit Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translateDynamic('support.form.submit')}
        accessibilityState={{ busy: isPending }}
        disabled={isPending}
        onPress={submitDraft}
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: theme.colors.primary,
            opacity: pressed || isPending ? 0.85 : 1
          }
        ]}
      >
        <StyledText style={styles.submitButtonText}>
          {translateDynamic('support.form.submit')}
        </StyledText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
    minHeight: '100%'
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  backButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    minWidth: 48,
    width: 48
  },
  heroHeader: {
    marginTop: spacing.xs
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 18,
    padding: spacing.lg
  },
  sectionGroup: {
    gap: spacing.xs
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700'
  },
  labelRow: {
    alignItems: 'center',
    ...layoutDirectionStyle('ltr'),
    gap: 2
  },
  asterisk: {
    fontSize: 16,
    fontWeight: '700'
  },
  chipsContainer: {
    ...layoutDirectionStyle('ltr'),
    flexWrap: 'wrap',
    gap: 10
  },
  chip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  chipText: {
    fontSize: 14
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14
  },
  textarea: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  errorText: {
    fontSize: 12,
    marginTop: 2
  },
  warningBanner: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    ...layoutDirectionStyle('ltr'),
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500'
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: radius.card,
    height: 54,
    justifyContent: 'center',
    marginTop: spacing.xs
  },
  submitButtonText: {
    color: colorTokens.raw["FFFFFF"],
    fontSize: 16,
    fontWeight: '700'
  }
});
