import DetailRoute from '../../../app/transactions/[id]';

it('exports the protected transaction detail route', () => {
  expect(typeof DetailRoute).toBe('function');
});
