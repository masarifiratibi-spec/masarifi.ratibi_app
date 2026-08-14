import React from 'react';
import { Tabs, router } from 'expo-router';

import { AppTabs } from '@/features/shell/AppTabs';
import { ProtectedRouteGate } from '@/features/shell/ProtectedRouteGate';

export default function TabsLayout() {
  return (
    <ProtectedRouteGate>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state }) => (
          <AppTabs
            currentRoute={`/(tabs)/${state.routeNames[state.index]}`}
            onSelect={(route) => router.navigate(route)}
          />
        )}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="add" />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="more" />
      </Tabs>
    </ProtectedRouteGate>
  );
}
