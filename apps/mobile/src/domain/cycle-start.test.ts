import {
  calculateCycleDateRange,
  formatDayOrdinal,
  MAX_CYCLE_START_DAY,
  MIN_CYCLE_START_DAY,
  SUPPORTED_CYCLE_START_DAYS
} from './cycle-start';

describe('cycle-start domain calculations', () => {
  describe('supported days', () => {
    it('supports exactly days 1 through 28', () => {
      expect(MIN_CYCLE_START_DAY).toBe(1);
      expect(MAX_CYCLE_START_DAY).toBe(28);
      expect(SUPPORTED_CYCLE_START_DAYS.length).toBe(28);
      expect(SUPPORTED_CYCLE_START_DAYS[0]).toBe(1);
      expect(SUPPORTED_CYCLE_START_DAYS[27]).toBe(28);
    });
  });

  describe('formatDayOrdinal', () => {
    it('formats English ordinals correctly', () => {
      expect(formatDayOrdinal(1, 'en')).toBe('1st');
      expect(formatDayOrdinal(2, 'en')).toBe('2nd');
      expect(formatDayOrdinal(3, 'en')).toBe('3rd');
      expect(formatDayOrdinal(4, 'en')).toBe('4th');
      expect(formatDayOrdinal(11, 'en')).toBe('11th');
      expect(formatDayOrdinal(12, 'en')).toBe('12th');
      expect(formatDayOrdinal(13, 'en')).toBe('13th');
      expect(formatDayOrdinal(21, 'en')).toBe('21st');
      expect(formatDayOrdinal(22, 'en')).toBe('22nd');
      expect(formatDayOrdinal(23, 'en')).toBe('23rd');
      expect(formatDayOrdinal(28, 'en')).toBe('28th');
    });

    it('formats Arabic ordinals correctly', () => {
      expect(formatDayOrdinal(1, 'ar')).toBe('1');
      expect(formatDayOrdinal(15, 'ar')).toBe('15');
      expect(formatDayOrdinal(28, 'ar')).toBe('28');
    });
  });

  describe('calculateCycleDateRange', () => {
    it('calculates full month range for day 1 in August 2026', () => {
      const refDate = new Date(2026, 7, 20); // Aug 20, 2026
      const result = calculateCycleDateRange(1, refDate, 'en');

      expect(result.startDate.getDate()).toBe(1);
      expect(result.startDate.getMonth()).toBe(7); // Aug
      expect(result.endDate.getDate()).toBe(31);
      expect(result.endDate.getMonth()).toBe(7); // Aug
      expect(result.formattedRange).toBe('Aug 1 - Aug 31');
    });

    it('calculates split month range for day 8 in August 2026', () => {
      const refDate = new Date(2026, 7, 20); // Aug 20, 2026
      const result = calculateCycleDateRange(8, refDate, 'en');

      expect(result.startDate.getDate()).toBe(8);
      expect(result.startDate.getMonth()).toBe(7); // Aug
      expect(result.endDate.getDate()).toBe(7);
      expect(result.endDate.getMonth()).toBe(8); // Sep
      expect(result.formattedRange).toBe('Aug 8 - Sep 7');
    });

    it('does not preview a future cycle when its start day has not arrived', () => {
      const refDate = new Date(2026, 7, 20); // Aug 20, 2026
      const result = calculateCycleDateRange(28, refDate, 'en');

      expect(result.startDate.getDate()).toBe(28);
      expect(result.startDate.getMonth()).toBe(6); // Jul
      expect(result.endDate.getDate()).toBe(27);
      expect(result.endDate.getMonth()).toBe(7); // Aug
      expect(result.formattedRange).toBe('Jul 28 - Aug 27');
    });

    it('handles year transition across December to January', () => {
      const refDate = new Date(2026, 11, 15); // Dec 15, 2026
      const result = calculateCycleDateRange(15, refDate, 'en');

      expect(result.startDate.getFullYear()).toBe(2026);
      expect(result.startDate.getMonth()).toBe(11); // Dec
      expect(result.startDate.getDate()).toBe(15);

      expect(result.endDate.getFullYear()).toBe(2027);
      expect(result.endDate.getMonth()).toBe(0); // Jan
      expect(result.endDate.getDate()).toBe(14);
      expect(result.formattedRange).toBe('Dec 15 - Jan 14');
    });

    it('handles February leap year (2024)', () => {
      const refDate = new Date(2024, 1, 10); // Feb 10, 2024
      const resultDay1 = calculateCycleDateRange(1, refDate, 'en');
      expect(resultDay1.endDate.getDate()).toBe(29);
      expect(resultDay1.formattedRange).toBe('Feb 1 - Feb 29');

      const resultDay15 = calculateCycleDateRange(15, refDate, 'en');
      expect(resultDay15.endDate.getDate()).toBe(14);
      expect(resultDay15.startDate.getMonth()).toBe(0); // Jan
      expect(resultDay15.endDate.getMonth()).toBe(1); // Feb
      expect(resultDay15.formattedRange).toBe('Jan 15 - Feb 14');
    });

    it('handles February non-leap year (2025)', () => {
      const refDate = new Date(2025, 1, 10); // Feb 10, 2025
      const resultDay1 = calculateCycleDateRange(1, refDate, 'en');
      expect(resultDay1.endDate.getDate()).toBe(28);
      expect(resultDay1.formattedRange).toBe('Feb 1 - Feb 28');
    });

    it('formats Arabic date ranges accurately', () => {
      const refDate = new Date(2026, 7, 20); // Aug 20, 2026
      const result = calculateCycleDateRange(1, refDate, 'ar');
      expect(result.formattedRange).toContain('1');
      expect(result.formattedRange).toContain('31');
    });

    it('clamps values below 1 or above 28', () => {
      const refDate = new Date(2026, 7, 20);
      const below = calculateCycleDateRange(-5, refDate, 'en');
      expect(below.startDate.getDate()).toBe(1);

      const above = calculateCycleDateRange(35, refDate, 'en');
      expect(above.startDate.getDate()).toBe(28);
    });
  });
});
