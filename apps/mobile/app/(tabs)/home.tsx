import React from 'react';
import { HomeScreen } from '@/features/home/HomeScreen';
import { HomeTrackingEntry } from '@/features/tracking/HomeTrackingEntry';

export default function HomeRoute() {
  const notice = React.useMemo(() => <HomeTrackingEntry />, []);
  return <HomeScreen notice={notice} />;
}
