import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  InitialHomeLoadingBoundary,
  useInitialHomeReadiness
} from './InitialHomeLoadingBoundary';

function Page({
  home = 'ready',
  header = 'ready',
  notice = 'ready'
}: {
  home?: 'pending' | 'ready' | 'failed';
  header?: 'pending' | 'ready';
  notice?: 'pending' | 'ready';
}) {
  useInitialHomeReadiness('home', home);
  useInitialHomeReadiness('header', header);
  useInitialHomeReadiness('notice', notice);
  return <Text>{home === 'failed' ? 'Retry page' : 'Complete page'}</Text>;
}

function layoutPage() {
  fireEvent(
    screen.getByTestId('initial-home-content', { includeHiddenElements: true }),
    'layout',
    {
      nativeEvent: { layout: { width: 360, height: 720, x: 0, y: 0 } }
    }
  );
}

it.each(['home', 'header', 'notice'] as const)(
  'keeps the branded cover while initial %s content is pending, then reveals the laid-out page',
  (part) => {
    const view = render(
      <InitialHomeLoadingBoundary isHome>
        <Page {...{ [part]: 'pending' as const }} />
      </InitialHomeLoadingBoundary>
    );
    expect(screen.getByTestId('startup-loading')).toBeTruthy();
    expect(screen.queryByText('Complete page')).toBeNull();
    layoutPage();
    view.rerender(
      <InitialHomeLoadingBoundary isHome>
        <Page />
      </InitialHomeLoadingBoundary>
    );
    expect(screen.queryByTestId('startup-loading')).toBeNull();
    expect(screen.getByText('Complete page')).toBeTruthy();
    view.rerender(
      <InitialHomeLoadingBoundary isHome>
        <Page home="pending" />
      </InitialHomeLoadingBoundary>
    );
    expect(screen.queryByTestId('startup-loading')).toBeNull();
  }
);

it('releases the existing error and retry without waiting for other reads or layout', () => {
  render(
    <InitialHomeLoadingBoundary isHome>
      <Page home="failed" header="pending" notice="pending" />
    </InitialHomeLoadingBoundary>
  );
  expect(screen.queryByTestId('startup-loading')).toBeNull();
  expect(screen.getByText('Retry page')).toBeTruthy();
});

it('never covers Home when another page was the first destination', () => {
  const view = render(
    <InitialHomeLoadingBoundary isHome={false}>
      <Page home="pending" />
    </InitialHomeLoadingBoundary>
  );
  expect(screen.queryByTestId('startup-loading')).toBeNull();
  view.rerender(
    <InitialHomeLoadingBoundary isHome>
      <Page home="pending" />
    </InitialHomeLoadingBoundary>
  );
  expect(screen.queryByTestId('startup-loading')).toBeNull();
});

it('does not bring the cover back after leaving the first Home', () => {
  const view = render(
    <InitialHomeLoadingBoundary isHome>
      <Page home="pending" />
    </InitialHomeLoadingBoundary>
  );
  expect(screen.getByTestId('startup-loading')).toBeTruthy();
  view.rerender(
    <InitialHomeLoadingBoundary isHome={false}>
      <Page />
    </InitialHomeLoadingBoundary>
  );
  view.rerender(
    <InitialHomeLoadingBoundary isHome>
      <Page home="pending" />
    </InitialHomeLoadingBoundary>
  );
  expect(screen.queryByTestId('startup-loading')).toBeNull();
});
