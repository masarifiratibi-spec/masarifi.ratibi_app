import { createContext, useContext } from 'react';

export type IdentityStatus =
  'loading' | 'ready' | 'sso' | 'error' | 'unavailable' | 'cancelled' | 'incomplete';
export const LiveIdentityStatusContext = createContext<{
  status: IdentityStatus;
  retry: () => void;
}>({ status: 'ready', retry: () => {} });
export const useLiveIdentityStatus = () =>
  useContext(LiveIdentityStatusContext);

export const LiveClerkSessionContext = createContext<string | null | undefined>(
  undefined
);

export const useLiveClerkSessionKey = () => useContext(LiveClerkSessionContext);
