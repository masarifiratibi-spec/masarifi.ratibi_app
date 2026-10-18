import React from 'react';
import { HomeScreen } from '@/features/home/HomeScreen';
import { TrackingHomeCard } from '@/features/tracking/TrackingHomeCard';

export default function HomeRoute() {
  const notice = React.useMemo(() => <TrackingHomeCard />, []);
  return <HomeScreen notice={notice} />;
}
