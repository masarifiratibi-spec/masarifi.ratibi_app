import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FontGate } from '@/design-system/typography';
import {
  StartupLoadingBoundary,
  StartupLoadingStage,
  useStartupReady
} from './StartupLoadingBoundary';

jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: jest.fn()
}));
const { useFonts } = jest.requireMock('expo-font') as { useFonts: jest.Mock };

function Destination({ ready }: { ready: boolean }) {
  useStartupReady(ready);
  return ready ? <Text>Ready destination</Text> : <StartupLoadingStage />;
}

it('retains the same cover across font and route loading, then reveals the ready destination', () => {
  useFonts.mockReturnValue([false, null]);
  const page = (ready: boolean) => (
    <StartupLoadingBoundary>
      <FontGate>
        <Destination ready={ready} />
      </FontGate>
    </StartupLoadingBoundary>
  );
  const view = render(page(false));
  const cover = screen.getByTestId('startup-loading');
  expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  useFonts.mockReturnValue([true, null]);
  view.rerender(page(false));
  expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  expect(screen.getByTestId('startup-loading') === cover).toBe(true);
  view.rerender(page(true));
  expect(screen.queryByTestId('startup-loading')).toBeNull();
  expect(screen.getByText('Ready destination')).toBeOnTheScreen();
});
