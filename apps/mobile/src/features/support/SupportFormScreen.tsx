import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import type { SupportDraftInput } from '@/domain/support';
import { useSaveSupportDraft, useSubmitSupportDraft } from './support-queries';
import { useSupportDraft } from './useSupportDraft';
import { RadioCard } from '@/design-system/components/forms/SelectionControls';
import { translateDynamic } from '@/localization/i18n';

export type SupportFormMode = SupportDraftInput['mode'];

export function SupportFormScreen({ mode = 'ticket', context = null }: { mode?: SupportFormMode; context?: SupportDraftInput['context'] }) {
  const draftId = useMemo(() => `support-draft-${mode}`, [mode]);
  const draft = useSupportDraft({ draftId, mode, initialContext: context });
  const save = useSaveSupportDraft();
  const submit = useSubmitSupportDraft();
  const [subject, setSubject] = useState(draft.values.subject);
  const [description, setDescription] = useState(draft.values.description);
  const [showSubjectError, setShowSubjectError] = useState(false);
  const [showDescriptionError, setShowDescriptionError] = useState(false);

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
    await save.mutateAsync({ ...draft.values, id: draftId, mode, subject, description } as SupportDraftInput);
    submit.mutate(
      { draftId, operationId: `support-submit-${Date.now()}` },
      { onSuccess: () => draft.markSubmitted?.() }
    );
  }

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">support.form.title</StyledText>
      {draft.values.context?.itemKind === 'transaction' ? <StyledText>support.form.context.transaction</StyledText> : null}
      {draft.values.context?.itemKind === 'assistant_response' ? <StyledText>support.form.context.assistant</StyledText> : null}
      {draft.values.context ? <ActionButton label="support.form.removeContext" variant="secondary" onPress={() => draft.update({ context: null })} /> : null}
      {(['billing', 'technical', 'privacy', 'account', 'feedback'] as const).map((category) => (
        <RadioCard key={category} label={`support.category.${category}`} selected={draft.values.category === category} onPress={() => draft.update({ category })} />
      ))}
      <TextInput accessibilityLabel={translateDynamic('support.form.subject')} value={subject} onChangeText={(next) => { setSubject(next); setShowSubjectError(false); draft.update({ subject: next }); }} />
      <TextInput accessibilityLabel={translateDynamic('support.form.description')} multiline value={description} onChangeText={(next) => { setDescription(next); setShowDescriptionError(false); draft.update({ description: next }); }} />
      {showSubjectError ? <StyledText>support.form.validation.subject</StyledText> : null}
      {showDescriptionError ? <StyledText>support.form.validation.description</StyledText> : null}
      {draft.safeFailure ? <StyledText>{`support.form.failure.${draft.safeFailure}`}</StyledText> : null}
      <ActionButton label="support.form.submit" loading={save.isPending || submit.isPending} onPress={submitDraft} />
    </ScrollView>
  );
}
