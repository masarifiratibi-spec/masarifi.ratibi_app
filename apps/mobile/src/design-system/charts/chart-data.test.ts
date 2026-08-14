import { limitDonutSegments, limitLineSeries } from './chart-data';

describe('chart data helpers', () => {
  it('groups donut data into five visible categories without mutating caller data', () => {
    const input = [
      { label: 'A', value: 5 },
      { label: 'B', value: 4 },
      { label: 'C', value: 3 },
      { label: 'D', value: 2 },
      { label: 'E', value: 1 },
      { label: 'F', value: 1 }
    ];
    const copy = input.map((item) => ({ ...item }));

    expect(limitDonutSegments(input)).toEqual([
      { label: 'A', value: 5 },
      { label: 'B', value: 4 },
      { label: 'C', value: 3 },
      { label: 'D', value: 2 },
      { label: 'Other', value: 2 }
    ]);
    expect(input).toEqual(copy);
  });

  it('limits line series to four', () => {
    expect(limitLineSeries(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd']);
  });
});
