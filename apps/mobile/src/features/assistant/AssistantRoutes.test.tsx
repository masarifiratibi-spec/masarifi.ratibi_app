import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AssistantRoute = require('@app/assistant').default as () => React.ReactElement;
const AssistantConversationRoute = require('@app/assistant/[conversationId]').default as () => React.ReactElement;
const AssistantActionRoute = require('@app/assistant/[conversationId]/actions/[previewId]').default as () => React.ReactElement;
const { AssistantHomeScreen } = require('./AssistantHomeScreen') as Record<string, React.ComponentType<any>>;
const { AssistantConversationScreen } = require('./AssistantConversationScreen') as Record<string, React.ComponentType<any>>;
const { AssistantActionPreviewScreen } = require('./AssistantActionPreviewScreen') as Record<string, React.ComponentType<any>>;

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ conversationId: 'conversation-1', previewId: 'preview-1', href: 'https://evil.example' }) }));

test('owns assistant routes with thin render-only modules and rejected raw destinations', () => {
  expect(AssistantRoute()).toEqual(<AssistantHomeScreen />);
  expect(AssistantConversationRoute()).toEqual(<AssistantConversationScreen conversationId="conversation-1" />);
  expect(AssistantActionRoute()).toEqual(<AssistantActionPreviewScreen conversationId="conversation-1" previewId="preview-1" />);

  [
    'app/assistant/index.tsx',
    'app/assistant/[conversationId]/index.tsx',
    'app/assistant/[conversationId]/actions/[previewId].tsx',
    'app/assistant/_layout.tsx'
  ].forEach((path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).not.toMatch(/sqlite|storage\/|router\.push\((params|search|url)|https?:\/\//i);
  });
});
