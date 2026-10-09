import { useEffect } from 'react';
import { useVoiceRuntime } from './VoiceCaptureRuntime';

export function useVoiceCapture({
  permissionSync = 'on-mount'
}: {
  permissionSync?: 'on-mount' | 'on-demand';
} = {}) {
  const runtime = useVoiceRuntime();
  useEffect(() => {
    if (permissionSync === 'on-mount') void runtime.syncPermission();
  }, [permissionSync, runtime.syncPermission]);
  return runtime;
}
