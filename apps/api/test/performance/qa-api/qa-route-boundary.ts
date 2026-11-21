import type { RequestHandler } from 'express';

import { REFERENCE_ROUTES } from '../../../src/reference/reference.controller';
import { REPORT_ROUTES } from '../../../src/reports/reports.controller';

const referenceOperations = new Set([
  'listCurrencies',
  'listCountries',
  'getExchangeRate',
  'listCategories',
  'getCategoryUsage',
  'createCategory',
  'updateCategory',
  'archiveCategory',
  'restoreCategory',
  'mergeCategory',
  'listAccounts',
  'createAccount',
  'getAccount',
  'updateAccount',
  'archiveAccount',
  'restoreAccount',
  'closeAccount',
  'calculateCreditCardPayoff',
]);
const reportOperations = new Set([
  'getDashboardHome',
  'getReportSummary',
  'listReportAttempts',
  'getReportAttempt',
  'listReportSchedules',
  'getReportSchedule',
]);

/** A new production route requires explicit admission to this provider-free composition. */
export const QA_ROUTES: readonly Readonly<{ method: string; path: string }>[] = Object.freeze(
  [
    { method: 'GET', path: 'api/v1/me' },
    { method: 'PATCH', path: 'api/v1/me' },
    { method: 'GET', path: 'api/v1/me/preferences' },
    { method: 'PUT', path: 'api/v1/me/preferences' },
    { method: 'GET', path: 'api/v1/me/onboarding' },
    { method: 'PUT', path: 'api/v1/me/onboarding' },
    { method: 'GET', path: 'api/v1/me/devices' },
    { method: 'POST', path: 'api/v1/me/devices/register' },
    { method: 'GET', path: 'api/v1/meta' },
    { method: 'GET', path: 'api/v1/meta/social-media' },
    { method: 'GET', path: 'api/v1/transactions' },
    { method: 'POST', path: 'api/v1/transactions' },
    { method: 'GET', path: 'api/v1/transactions/:transactionId' },
    { method: 'PATCH', path: 'api/v1/transactions/:transactionId' },
    { method: 'DELETE', path: 'api/v1/transactions/:transactionId' },
    { method: 'POST', path: 'api/v1/transfers' },
    { method: 'POST', path: 'api/v1/transactions/:transactionId/refunds' },
    { method: 'POST', path: 'api/v1/transactions/:transactionId/reverse' },
    { method: 'POST', path: 'api/v1/transactions/:transactionId/restore' },
    { method: 'GET', path: 'api/v1/accounts/:accountId/summary' },
    { method: 'GET', path: 'api/v1/sync/bootstrap' },
    { method: 'GET', path: 'api/v1/sync/delta' },
    { method: 'POST', path: 'api/v1/sync/ack' },
    { method: 'POST', path: 'api/v1/sync/mutations' },
    { method: 'GET', path: 'api/v1/conflicts' },
    { method: 'GET', path: 'api/v1/conflicts/:conflictId' },
    { method: 'PATCH', path: 'api/v1/conflicts/:conflictId' },
    ...REFERENCE_ROUTES.filter((route) => referenceOperations.has(route.operation)).map(
      ({ method, path }) => ({ method, path }),
    ),
    ...REPORT_ROUTES.filter((route) => reportOperations.has(route.operation)).map(
      ({ method, path }) => ({ method, path }),
    ),
  ].map((route) => Object.freeze(route)),
);

const admittedRoutes = QA_ROUTES.map((route) => ({
  method: route.method,
  path: new RegExp(
    '^/' +
      route.path
        .split('/')
        .map((segment) =>
          segment.startsWith(':')
            ? '[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}'
            : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('/') +
      '/?$',
  ),
}));

export const qaRouteBoundary: RequestHandler = (request, response, next): void => {
  if (
    admittedRoutes.some((route) => route.method === request.method && route.path.test(request.path))
  ) {
    next();
    return;
  }
  response.status(404).json({ code: 'NOT_FOUND' });
};
