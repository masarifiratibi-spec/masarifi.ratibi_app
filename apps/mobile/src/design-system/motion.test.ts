import { Animated } from 'react-native';

import { createTiming, motionDurations } from './motion';

describe('SPEC-002 motion', () => {
  it('defines approved duration buckets', () => {
    expect(motionDurations.micro).toBeGreaterThanOrEqual(100);
    expect(motionDurations.micro).toBeLessThanOrEqual(140);
    expect(motionDurations.control).toBeGreaterThanOrEqual(140);
    expect(motionDurations.control).toBeLessThanOrEqual(180);
    expect(motionDurations.dialog).toBeGreaterThanOrEqual(180);
    expect(motionDurations.dialog).toBeLessThanOrEqual(220);
    expect(motionDurations.sheet).toBeGreaterThanOrEqual(200);
    expect(motionDurations.sheet).toBeLessThanOrEqual(240);
  });

  it('uses Animated timing for ordinary motion', () => {
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn()
    } as unknown as Animated.CompositeAnimation);

    createTiming(new Animated.Value(0), 1, 'control', false);

    expect(timing).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({ toValue: 1, duration: motionDurations.control })
    );
  });

  it('applies final state immediately for reduced motion', () => {
    const value = new Animated.Value(0);

    const animation = createTiming(value, 1, 'sheet', true);

    expect(animation).toBeNull();
    expect((value as unknown as { __getValue: () => number }).__getValue()).toBe(1);
  });
});
