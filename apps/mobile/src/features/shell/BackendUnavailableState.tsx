import React from 'react';

import { StateView } from '@/design-system/components/feedback/StateView';

export function BackendUnavailableState({ title }: { title: string }) {
  return <StateView state="error" title={title} />;
}
