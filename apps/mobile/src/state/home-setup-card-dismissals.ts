import { create } from 'zustand';

import {
  registerRuntimeIdentityReset,
  registerRuntimeUserDataReset
} from '@/storage/runtime-user-data-reset';

type SetupCard = 'notifications' | 'sms' | 'transaction-notifications';

interface HomeSetupCardDismissals {
  ownerId: string | null;
  cards: readonly SetupCard[];
  dismiss: (ownerId: string, card: SetupCard) => void;
}

// Session-only UI choices: a fresh app process starts with every suggestion eligible.
export const useHomeSetupCardDismissals = create<HomeSetupCardDismissals>(
  (set) => ({
    ownerId: null,
    cards: [],
    dismiss: (ownerId, card) =>
      set((state) => ({
        ownerId,
        cards: [
          ...new Set([...(state.ownerId === ownerId ? state.cards : []), card])
        ]
      }))
  })
);

const clearDismissals = () =>
  useHomeSetupCardDismissals.setState({ ownerId: null, cards: [] });
registerRuntimeUserDataReset(clearDismissals);
registerRuntimeIdentityReset((context) => {
  if (
    context &&
    'restoringOwnerId' in context &&
    context.restoringOwnerId === useHomeSetupCardDismissals.getState().ownerId
  )
    return;
  clearDismissals();
});
