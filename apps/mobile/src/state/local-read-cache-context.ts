import { createContext } from 'react';

/** Only the encrypted local read attempt; never waits for a remote request. */
export const LocalReadCacheReady = createContext(true);
