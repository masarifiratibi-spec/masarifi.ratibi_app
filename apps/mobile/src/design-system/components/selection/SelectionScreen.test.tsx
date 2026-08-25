import { fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';
import { formatDayOrdinal } from '@/domain/cycle-start';
import { SelectionScreen } from './SelectionScreen';
import type { SelectionItem } from './selection-types';

const mockItems: SelectionItem<string>[] = [
  { id: 'SAR', title: 'Saudi Riyal', subtitle: 'SAR', icon: '🇸🇦' },
  { id: 'EGP', title: 'Egyptian Pound', subtitle: 'EGP', icon: '🇪🇬' },
  { id: 'USD', title: 'US Dollar', subtitle: 'USD', icon: '🇺🇸' },
  { id: 'EUR', title: 'Euro', subtitle: 'EUR', icon: '🇪🇺' }
];

describe('SelectionScreen generic component', () => {
  it('renders list items and calls onSelect when an item is tapped', () => {
    const onSelect = jest.fn();
    const onBack = jest.fn();

    const { getByText } = renderWithProviders(
      <SelectionScreen
        title="Select Currency"
        subtitle="Choose your default currency"
        items={mockItems}
        selectedId="SAR"
        onSelect={onSelect}
        onBack={onBack}
      />
    );

    expect(getByText('Select Currency')).toBeTruthy();
    expect(getByText('Choose your default currency')).toBeTruthy();
    expect(getByText('Saudi Riyal')).toBeTruthy();
    expect(getByText('Egyptian Pound')).toBeTruthy();

    fireEvent.press(getByText('Egyptian Pound'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockItems[1]);
  });

  it('filters items when search input is typed', () => {
    const onSelect = jest.fn();

    const { getByTestId, getByText, queryByText } = renderWithProviders(
      <SelectionScreen
        title="Select Currency"
        items={mockItems}
        selectedId="SAR"
        onSelect={onSelect}
        searchable
        searchPlaceholder="Search currency..."
      />
    );

    const searchInput = getByTestId('selection-search-input');
    expect(searchInput).toBeTruthy();

    fireEvent.changeText(searchInput, 'Dollar');
    expect(getByText('US Dollar')).toBeTruthy();
    expect(queryByText('Saudi Riyal')).toBeNull();
    expect(queryByText('Egyptian Pound')).toBeNull();
  });

  it('renders in grid mode with custom number of columns', () => {
    const onSelect = jest.fn();
    const dayItems: SelectionItem<number>[] = Array.from({ length: 28 }, (_, i) => ({
      id: i + 1,
      title: formatDayOrdinal(i + 1, 'en'),
      subtitle: `Aug ${i + 1} - Sep ${i}`
    }));

    const { getByText } = renderWithProviders(
      <SelectionScreen
        title="Month Starts On"
        items={dayItems}
        selectedId={1}
        onSelect={onSelect}
        layoutMode="grid"
        numColumns={4}
      />
    );

    expect(getByText('1st')).toBeTruthy();
    expect(getByText('28th')).toBeTruthy();

    fireEvent.press(getByText('15th'));
    expect(onSelect).toHaveBeenCalledWith(dayItems[14]);
  });

  it('supports custom item renderer', () => {
    const onSelect = jest.fn();

    const { getByText } = renderWithProviders(
      <SelectionScreen
        title="Custom Selector"
        items={mockItems}
        selectedId="USD"
        onSelect={onSelect}
        renderItem={({ item, onPress }) => (
          <Pressable key={item.id} onPress={onPress}>
            <Text>{item.title} - CUSTOM</Text>
          </Pressable>
        )}
      />
    );

    expect(getByText('Saudi Riyal - CUSTOM')).toBeTruthy();
  });
});
