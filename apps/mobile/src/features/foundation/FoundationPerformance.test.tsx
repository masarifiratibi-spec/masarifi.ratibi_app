import React from 'react';
import { FlatList, Text } from 'react-native';
import { render } from '@testing-library/react-native';

const transactions = Array.from({ length: 10_000 }, (_, index) => ({
  id: `transaction-${index}`,
  amount: index + 1
}));

describe('foundation list performance', () => {
  it('virtualizes 10,000 records instead of mounting the full collection', () => {
    const { getAllByTestId } = render(
      <FlatList
        data={transactions}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        keyExtractor={(transaction) => transaction.id}
        renderItem={({ item }) => (
          <Text testID="virtualized-transaction">{item.amount}</Text>
        )}
      />
    );

    const mountedRows = getAllByTestId('virtualized-transaction');
    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThan(100);
  });
});
