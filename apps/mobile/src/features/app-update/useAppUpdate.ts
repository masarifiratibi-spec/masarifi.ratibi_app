import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  installedApplication,
  requestUpdatePolicy,
  updateAvailable,
  type UpdatePolicy
} from './app-update';

const snoozeKey = 'masarifi.appUpdate.snooze.v1';
const recheckMs = 5 * 60_000;
const snoozeMs = 24 * 60 * 60_000;
type CheckState = {
  status: 'checking' | 'current' | 'available' | 'unavailable';
  policy: UpdatePolicy | null;
  snoozed: boolean;
};

export function useAppUpdate(enabled: boolean, ignoreSnooze = false) {
  const [state, setState] = useState<CheckState>({
    status: 'checking',
    policy: null,
    snoozed: false
  });
  const request = useRef<AbortController | null>(null);
  const lastCheck = useRef(0);
  const sessionSnoozed = useRef(new Map<number, number>());

  const refresh = useCallback(
    async (force = false) => {
      if (
        !enabled ||
        request.current ||
        (!force && Date.now() - lastCheck.current < recheckMs)
      )
        return;
      const controller = new AbortController();
      request.current = controller;
      lastCheck.current = Date.now();
      setState((previous) => ({ ...previous, status: 'checking' }));
      try {
        const policy = await requestUpdatePolicy(undefined, undefined, {
          signal: controller.signal
        });
        const available = updateAvailable(policy, installedApplication());
        let snoozed = false;
        if (available && policy.enabled && !ignoreSnooze) {
          for (const [versionCode, until] of sessionSnoozed.current) {
            if (until <= Date.now()) sessionSnoozed.current.delete(versionCode);
          }
          snoozed =
            (sessionSnoozed.current.get(policy.release.versionCode) ?? 0) >
            Date.now();
          try {
            const stored: unknown = JSON.parse(
              (await AsyncStorage.getItem(snoozeKey)) ?? 'null'
            );
            if (
              stored &&
              typeof stored === 'object' &&
              'versionCode' in stored &&
              'until' in stored
            )
              snoozed ||=
                stored.versionCode === policy.release.versionCode &&
                typeof stored.until === 'number' &&
                stored.until > Date.now() &&
                stored.until <= Date.now() + snoozeMs;
          } catch {
            /* Reminder persistence is optional; never block application use. */
          }
        }
        if (!controller.signal.aborted)
          setState({
            status: available ? 'available' : 'current',
            policy,
            snoozed
          });
      } catch {
        if (!controller.signal.aborted)
          setState({ status: 'unavailable', policy: null, snoozed: false });
      } finally {
        if (request.current === controller) request.current = null;
      }
    },
    [enabled, ignoreSnooze]
  );

  useEffect(() => {
    if (
      enabled &&
      (AppState.currentState === 'active' || AppState.currentState === null)
    )
      void refresh();
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => {
      listener.remove();
      request.current?.abort();
      request.current = null;
      lastCheck.current = 0;
    };
  }, [enabled, refresh]);

  const postpone = useCallback(async () => {
    if (!state.policy?.enabled) return;
    const versionCode = state.policy.release.versionCode;
    const until = Date.now() + snoozeMs;
    sessionSnoozed.current.set(versionCode, until);
    setState((previous) => ({ ...previous, snoozed: true }));
    try {
      await AsyncStorage.setItem(
        snoozeKey,
        JSON.stringify({ versionCode, until })
      );
    } catch {
      /* Keep the dismissal for this session even if storage is unavailable. */
    }
  }, [state.policy]);
  return { ...state, refresh, postpone };
}
