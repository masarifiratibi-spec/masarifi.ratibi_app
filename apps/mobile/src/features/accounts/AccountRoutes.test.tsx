import AccountsRoute from '../../../app/accounts';
import AccountNewRoute from '../../../app/accounts/new';
import AccountDetailRoute from '../../../app/accounts/[id]';
import AccountEditRoute from '../../../app/accounts/[id]/edit';

it('exports account list, create, detail, and edit routes', () => {
  expect([
    AccountsRoute,
    AccountNewRoute,
    AccountDetailRoute,
    AccountEditRoute
  ].every((route) => typeof route === 'function')).toBe(true);
});
