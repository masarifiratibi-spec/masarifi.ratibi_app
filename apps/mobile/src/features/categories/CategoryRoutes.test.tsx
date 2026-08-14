import CategoryRoute from '../../../app/categories';
import CategoryNewRoute from '../../../app/categories/new';
import CategoryDetailRoute from '../../../app/categories/[id]';

it('exports category list, create, and detail routes', () => {
  expect(
    [CategoryRoute, CategoryNewRoute, CategoryDetailRoute].every(
      (route) => typeof route === 'function'
    )
  ).toBe(true);
});
