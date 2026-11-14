import React from 'react';
import { Alert, Linking } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { SocialMediaLinks } from './SocialMediaLinks';

describe('social media footer', () => {
  it('shows only configured accounts and opens their saved URL', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    renderWithProviders(
      <SocialMediaLinks
        links={{
          instagram: 'https://instagram.com/masarifi',
          tiktok: '',
          snapchat: 'https://snapchat.com/add/masarifi'
        }}
      />
    );
    expect(screen.queryByLabelText('TikTok')).toBeNull();
    fireEvent.press(screen.getByLabelText('Instagram'));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('https://instagram.com/masarifi')
    );
    expect(screen.getByLabelText('Snapchat')).toBeTruthy();
  });
  it('renders no icons when no accounts are configured, or a link is unsafe', () => {
    renderWithProviders(
      <SocialMediaLinks
        links={{ instagram: 'javascript:alert(1)', tiktok: '', snapchat: '' }}
      />
    );
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
  it('reports an opening failure without an unhandled rejection', async () => {
    jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderWithProviders(
      <SocialMediaLinks
        links={{
          instagram: '',
          tiktok: 'https://tiktok.com/@masarifi',
          snapchat: ''
        }}
      />
    );
    fireEvent.press(screen.getByLabelText('TikTok'));
    await waitFor(() => expect(alert).toHaveBeenCalled());
  });
  afterEach(() => jest.restoreAllMocks());
});
