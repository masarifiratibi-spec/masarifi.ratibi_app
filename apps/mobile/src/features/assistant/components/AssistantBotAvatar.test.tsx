import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AssistantBotAvatar } from './AssistantBotAvatar';

describe('AssistantBotAvatar', () => {
  it('renders the bot avatar at default size', () => {
    render(<AssistantBotAvatar testID="bot-avatar" />);
    expect(screen.getByTestId('bot-avatar')).toBeTruthy();
  });

  it('renders with custom size and status dot', () => {
    render(<AssistantBotAvatar testID="bot-avatar-mini" size={36} showStatusDot />);
    expect(screen.getByTestId('bot-avatar-mini')).toBeTruthy();
    expect(screen.getByTestId('bot-status-dot')).toBeTruthy();
  });

  it('renders with halo ring for hero mode', () => {
    render(<AssistantBotAvatar testID="bot-avatar-hero" size={100} showHalo />);
    expect(screen.getByTestId('bot-avatar-hero')).toBeTruthy();
    expect(screen.getByTestId('bot-halo-ring')).toBeTruthy();
  });
});
