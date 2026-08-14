import React from 'react';
import { FlatList, Text, View } from 'react-native';
import type { AssistantResponse } from '@/domain/assistant';
import type { NotificationEvent } from '@/domain/notifications';

export function countMountedAssistantNotificationRows({ notifications, responses, render }: {
  notifications: readonly NotificationEvent[];
  responses: readonly AssistantResponse[];
  render: (ui: React.ReactElement) => unknown;
}) {
  let mountedRows = 0;
  const started = performance.now();
  render(React.createElement(View, null,
    React.createElement(FlatList<NotificationEvent>, {
      data: [...notifications],
      initialNumToRender: 49,
      keyExtractor: (item) => item.id,
      renderItem: ({ item }) => {
        mountedRows += 1;
        return React.createElement(Text, null, item.titleKey);
      }
    }),
    React.createElement(FlatList<AssistantResponse>, {
      data: [...responses],
      initialNumToRender: 49,
      keyExtractor: (item) => item.id,
      renderItem: ({ item }) => {
        mountedRows += 1;
        return React.createElement(Text, null, item.id);
      }
    })
  ));
  return {
    notificationCount: notifications.length,
    responseCount: responses.length,
    firstUsefulContentMs: performance.now() - started,
    maxMountedRows: mountedRows
  };
}
