import { createContext, useContext } from 'react';

export type IdentityStatus =
  'loading' | 'ready' | 'sso' | 'error' | 'cancelled' | 'incomplete';
export const LiveIdentityStatusContext = createContext<{
  status: IdentityStatus;
  retry: () => void;
}>({ status: 'ready', retry: () => {} });
export const useLiveIdentityStatus = () =>
  useContext(LiveIdentityStatusContext);
