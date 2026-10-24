import React from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { StartupLoading } from './StartupLoading';

// Jest otherwise infers only AccessibilityInfo's last (announcement) overload.
const motionEvents = AccessibilityInfo as {
  addEventListener: (
    event: 'reduceMotionChanged',
    listener: (enabled: boolean) => void
  ) => { remove: () => void };
};

afterEach(() => jest.restoreAllMocks());

it.each([
  ['ar', 'مصاريفي وراتبي', 'جارٍ تجهيز بياناتك…', 'rtl'],
  ['en', 'Masarifi & Ratibi', 'Preparing your data…', 'ltr']
] as const)(
  'renders %s without foundation providers and exposes one stable loading description',
  async (locale, brand, message, direction) => {
    const screen = render(<StartupLoading locale={locale} reducedMotion />);
    expect(
      screen.getByRole('progressbar', { name: `${brand}. ${message}` })
    ).toHaveProp('accessibilityLiveRegion', 'none');
    expect(
      screen.getByText(message, { includeHiddenElements: true })
    ).toHaveStyle({ writingDirection: direction });
    expect(
      screen.getByText(brand, { includeHiddenElements: true })
    ).toBeTruthy();
    await act(async () => {});
  }
);

it('stops rotation for system motion changes and removes the subscription on unmount', async () => {
  let onMotionChange: (enabled: boolean) => void = () => {};
  const remove = jest.fn();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(motionEvents, 'addEventListener')
    .mockImplementation((_event, listener) => {
      onMotionChange = listener;
      return { remove };
    });
  const start = jest.fn();
  const stop = jest.fn();
  jest
    .spyOn(Animated, 'loop')
    .mockReturnValue({ start, stop, reset: jest.fn() });
  const screen = render(<StartupLoading />);
  await act(async () => {});
  expect(start).toHaveBeenCalledTimes(1);
  act(() => onMotionChange(true));
  expect(stop).toHaveBeenCalledTimes(1);
  act(() => onMotionChange(false));
  expect(start).toHaveBeenCalledTimes(2);
  screen.unmount();
  expect(stop).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledTimes(1);
});

it('does not animate when the application requests reduced motion', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  const loop = jest.spyOn(Animated, 'loop');
  const screen = render(<StartupLoading reducedMotion />);
  await act(async () => {});
  expect(loop).not.toHaveBeenCalled();
  screen.unmount();
});

it('ignores a late motion query after unmount', async () => {
  let resolveMotion: (enabled: boolean) => void = () => {};
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
    new Promise((resolve) => {
      resolveMotion = resolve;
    })
  );
  const loop = jest.spyOn(Animated, 'loop');
  const screen = render(<StartupLoading />);
  screen.unmount();
  await act(async () => resolveMotion(false));
  expect(loop).not.toHaveBeenCalled();
});

it('keeps a newer reduced-motion event when the initial query resolves late', async () => {
  let resolveMotion: (enabled: boolean) => void = () => {};
  let onMotionChange: (enabled: boolean) => void = () => {};
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
    new Promise((resolve) => {
      resolveMotion = resolve;
    })
  );
  jest
    .spyOn(motionEvents, 'addEventListener')
    .mockImplementation((_event, listener) => {
      onMotionChange = listener;
      return { remove: jest.fn() };
    });
  const loop = jest.spyOn(Animated, 'loop');
  const screen = render(<StartupLoading />);
  act(() => onMotionChange(true));
  await act(async () => resolveMotion(false));
  expect(loop).not.toHaveBeenCalled();
  screen.unmount();
});
