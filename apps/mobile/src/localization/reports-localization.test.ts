import ar from './messages/ar';
import en from './messages/en';

test('report message keys have Arabic and English parity', () => {
  const keys = Object.keys(en).filter((key) => key.startsWith('reports.'));

  expect(keys.length).toBeGreaterThan(10);
  expect(keys.every((key) => key in ar)).toBe(true);
});

test('Arabic report labels are translated rather than copied from English', () => {
  expect(ar['reports.title']).not.toBe(en['reports.title']);
  expect(ar['reports.action.preview']).toMatch(/[\u0600-\u06FF]/);
  expect(ar['reports.state.empty']).toMatch(/[\u0600-\u06FF]/);
});
