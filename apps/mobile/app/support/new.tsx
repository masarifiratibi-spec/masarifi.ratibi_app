import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { SupportFormScreen, type SupportFormMode } from '@/features/support/SupportFormScreen';
import type { SupportDraftInput } from '@/domain/support';
import { supportContextSchema } from '@/domain/support';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function NewSupportRoute() {
  const params = useLocalSearchParams();
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('support.backendUnavailable')} />;
  const mode = modeFrom(params.mode);
  return <SupportFormScreen mode={mode} context={contextFrom(params.context, mode)} />;
}

function modeFrom(value: unknown): SupportFormMode {
  return value === 'feedback' || value === 'transaction_report' || value === 'assistant_report' || value === 'reply' ? value : 'ticket';
}

function contextFrom(value: unknown, mode: SupportFormMode): SupportDraftInput['context'] {
  if (typeof value !== 'string') return null;
  try {
    const parsed = supportContextSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    if (mode === 'transaction_report' && parsed.data.itemKind === 'transaction') return parsed.data;
    if (mode === 'assistant_report' && parsed.data.itemKind === 'assistant_response') return parsed.data;
    return null;
  } catch {
    return null;
  }
}
