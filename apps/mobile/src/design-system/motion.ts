import { Animated, Easing } from 'react-native';

export const motionDurations = {
  micro: 120,
  control: 160,
  dialog: 200,
  sheet: 220
} as const;

export type MotionBucket = keyof typeof motionDurations;

export function createTiming(
  value: Animated.Value,
  toValue: number,
  bucket: MotionBucket,
  reducedMotion: boolean
): Animated.CompositeAnimation | null {
  if (reducedMotion) {
    value.setValue(toValue);
    return null;
  }

  return Animated.timing(value, {
    toValue,
    duration: motionDurations[bucket],
    easing: Easing.out(Easing.exp),
    useNativeDriver: true
  });
}
