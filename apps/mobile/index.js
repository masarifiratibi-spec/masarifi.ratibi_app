import './src/services/platform/android-background-fetch';
import { registerTrackingHeadlessTask } from './src/services/tracking-background-runtime';
import './src/services/tracking-push-task';
registerTrackingHeadlessTask();
require('expo-router/entry');
