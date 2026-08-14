import React from 'react';
import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';

import { renderWithProviders, renderWithQueryData } from './render';

function Probe() {
  const query = useQuery({ queryKey: ['probe'], queryFn: async () => 'fresh' });
  return <Text>{query.data ?? 'loading'}</Text>;
}

it('isolates query state between renders', async () => {
  renderWithProviders(<Probe />);
  expect(await screen.findByText('fresh')).toBeTruthy();
});

it('renders preloaded query data without calling the query function', async () => {
  const queryFn = jest.fn(async () => 'network');
  function PreloadedProbe() {
    const query = useQuery({ queryKey: ['preloaded'], queryFn });
    return <Text>{query.data}</Text>;
  }
  renderWithQueryData(<PreloadedProbe />, [[['preloaded'], 'local']]);
  expect(await screen.findByText('local')).toBeTruthy();
  expect(queryFn).not.toHaveBeenCalled();
});
