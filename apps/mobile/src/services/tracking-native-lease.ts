import {
  captureTrackingAdmission,
  useTrackingAdmission
} from '@/state/tracking-admission';
import { readLogoutSessionAnchor } from './live/auth-service';

/** A native capability is bound to both the admitted identity and its SDK session. */
export async function captureTrackingNativeLease(ownerId?: string) {
  const assertAdmission = captureTrackingAdmission(ownerId);
  const state = useTrackingAdmission.getState();
  const lease = state.nativeLease;
  const assertCurrent = async () => {
    assertAdmission();
    if (
      lease &&
      (!state.admittedOwnerId ||
        !state.sessionAnchor ||
        (await readLogoutSessionAnchor(state.admittedOwnerId)) !==
          state.sessionAnchor)
    )
      throw new Error('tracking_admission_changed');
    assertAdmission();
    if (useTrackingAdmission.getState().nativeLease !== lease)
      throw new Error('tracking_admission_changed');
  };
  await assertCurrent();
  return { lease, assertCurrent };
}
