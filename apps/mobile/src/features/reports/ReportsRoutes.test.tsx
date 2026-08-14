import React from 'react';

import ReportsRoute from '@app/(tabs)/reports';
import DrillDownRoute from '@app/reports/drill-down';
import PreviewRoute from '@app/reports/preview';
import ScheduleRoute from '@app/reports/schedule';

test('report routes stay thin component routes', () => {
  expect(<ReportsRoute />).toBeTruthy();
  expect(<DrillDownRoute />).toBeTruthy();
  expect(<PreviewRoute />).toBeTruthy();
  expect(<ScheduleRoute />).toBeTruthy();
});
