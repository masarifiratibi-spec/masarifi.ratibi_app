import { reportStateTitle } from './report-state';
import { changeLocale } from '@/localization/i18n';

afterEach(() => changeLocale('en'));

test('report states map to safe recovery titles', () => {
  changeLocale('en');
  expect(reportStateTitle('empty')).toBe('No report activity yet');
  expect(reportStateTitle('offline')).toBe('Offline report');
});

test('report states use the active Arabic catalog', () => {
  changeLocale('ar');
  expect(reportStateTitle('empty')).toBe('لا توجد حركة مالية في هذه الفترة');
  expect(reportStateTitle('offline')).toBe('تقرير دون اتصال');
});
