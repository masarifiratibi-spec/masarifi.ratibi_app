import { act, renderHook } from '@testing-library/react-native';
import { useReportsViewState } from '@/state/reports-view-state';
import { usePreferenceStore } from '@/state/preferences';
import { useReportAnchorDate } from './useReportAnchorDate';

const priorTimeZone = usePreferenceStore.getState().timeZone;
const priorPeriod = useReportsViewState.getState();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-18T20:59:59Z'));
  usePreferenceStore.setState({ timeZone: 'Asia/Riyadh' });
  useReportsViewState.setState(useReportsViewState.getInitialState(), true);
});
afterEach(() => {
  usePreferenceStore.setState({ timeZone: priorTimeZone });
  useReportsViewState.setState(priorPeriod, true);
  jest.useRealTimers();
});

it.each([
  ['2026-10-18T20:59:59Z', '2026-10-18', '2026-10-19'],
  ['2026-10-31T20:59:59Z', '2026-10-31', '2026-11-01']
])(
  'advances the default report at local midnight (%s)',
  (instant, before, after) => {
    jest.setSystemTime(new Date(instant));
    const view = renderHook(useReportAnchorDate);
    expect(view.result.current).toBe(before);
    act(() => jest.advanceTimersByTime(1001));
    expect(view.result.current).toBe(after);
    view.unmount();
  }
);

it('uses the local date on a fresh visit after UTC day divergence', () => {
  jest.setSystemTime(new Date('2026-10-18T21:30:00Z'));
  const view = renderHook(useReportAnchorDate);
  expect(view.result.current).toBe('2026-10-19');
  view.unmount();
});

it('preserves an explicitly selected historical report across midnight and timezone changes', () => {
  useReportsViewState.getState().setPeriod('monthly', '2026-08-09');
  const view = renderHook(useReportAnchorDate);
  act(() => {
    jest.advanceTimersByTime(1001);
    usePreferenceStore.setState({ timeZone: 'Pacific/Auckland' });
  });
  expect(view.result.current).toBe('2026-08-09');
  view.unmount();
});
