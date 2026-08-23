import React from 'react';
import { Tabs, router } from 'expo-router';

import { AppTabs } from '@/features/shell/AppTabs';
import { ProtectedRouteGate } from '@/features/shell/ProtectedRouteGate';

export default function TabsLayout() {
  return (
    <ProtectedRouteGate>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state }) => {
          const currentName = state.routeNames[state.index];
          return currentName === 'reports' ||
            currentName === 'more' ? null : (
            <AppTabs
              currentRoute={`/(tabs)/${currentName}`}
              onSelect={(route) => router.navigate(route)}
            />
          );
        }}
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
