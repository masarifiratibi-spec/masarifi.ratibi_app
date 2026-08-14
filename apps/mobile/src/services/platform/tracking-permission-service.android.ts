import { Linking, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TrackingPermissionService } from '@/services/contracts/app-shell-service';
import { permissionState } from '@/services/mocks/tracking-permission-service';

const permissionHistoryKey = 'masarifi.appShell.smsPermissionStatus';

export function createAndroidTrackingPermissionService(): TrackingPermissionService {
  return {
    async getState() {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      if (granted) {
        await AsyncStorage.setItem(permissionHistoryKey, 'granted');
        return permissionState('granted');
      }
      const previous = await AsyncStorage.getItem(permissionHistoryKey);
      if (previous === 'granted') return permissionState('revoked');
      if (previous === 'permanently_denied') {
        return permissionState('permanently_denied');
      }
      if (previous === 'denied') return permissionState('denied');
      return permissionState('not_requested');
    },
    async requestAfterEducation() {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        await AsyncStorage.setItem(permissionHistoryKey, 'granted');
        return permissionState('granted');
      }
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        await AsyncStorage.setItem(permissionHistoryKey, 'permanently_denied');
        return permissionState('permanently_denied');
      }
      await AsyncStorage.setItem(permissionHistoryKey, 'denied');
      return permissionState('denied');
    },
    async openSettings() {
      await Linking.openSettings();
    }
  };
}

export const createTrackingPermissionService = createAndroidTrackingPermissionService;
