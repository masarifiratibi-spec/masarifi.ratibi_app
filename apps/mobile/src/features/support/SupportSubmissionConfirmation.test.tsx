import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { SupportDraft } from '@/domain/support';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { SupportHomeScreen } from './SupportHomeScreen';

const mockDrafts = new Map<string, SupportDraft>();
const mockRequest = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

jest.mock('expo-crypto', () => ({
  randomUUID: () => '11111111-1111-4111-8111-111111111111'
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
}));
jest.mock('@/services/engagement-service', () => {
  const actual = jest.requireActual('@/services/engagement-service');
  const { createLiveSupportService } = jest.requireActual(
    '@/services/live/engagement-service'
  );
  return {
    ...actual,
    supportService: createLiveSupportService({
      baseUrl: 'https://support.example.test',
      token: async () => 'test-token',
      request: (...args: Parameters<typeof fetch>) => mockRequest(...args),
      drafts: {
        loadDraft: async (id: string) => mockDrafts.get(id) ?? null,
        saveDraft: async (draft: SupportDraft) => {
          mockDrafts.set(draft.id, draft);
          return draft;
        },
        discardDraft: async (id: string) => {
          mockDrafts.delete(id);
        }
      }
    })
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequest.mockReset();
  mockDrafts.clear();
  changeLocale('en');
});

test.each(['technical', 'privacy', 'feedback'] as const)(
  'confirms %s delivery once, clears the saved draft, and returns without history',
  async (category) => {
    let accept!: (response: Response) => void;
    const delivery = new Promise<Response>((resolve) => {
      accept = resolve;
    });
    mockRequest.mockImplementation(async (_url, options) => {
      if (options?.method === 'GET')
        return response({
          items: [
            {
              id: id(21),
              key: category === 'privacy' ? 'other' : 'technical',
              name: 'Technical',
              sortOrder: 0,
              active: true,
              version: 1
            }
          ],
          nextCursor: null,
          hasMore: false
        });
      return delivery;
    });
    mockDrafts.set('support-draft-ticket', {
      id: 'support-draft-ticket',
      mode: 'ticket',
      category,
      subject: 'Help with the app ',
      description: ' The screen does not open. ',
      ticketId: null,
      context: null,
      status: 'draft',
      updatedAt: 1
    });
    renderWithProviders(<SupportHomeScreen />);
    await screen.findByDisplayValue('Help with the app ');
    const send = screen.getByRole('button', {
      name: translate('support.form.submit')
    });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.press(send);
    fireEvent.press(send);
    await waitFor(() =>
      expect(
        mockRequest.mock.calls.filter(([, init]) => init?.method === 'POST')
      ).toHaveLength(1)
    );
    expect(screen.queryByText('Message sent')).toBeNull();
    expect(
      mockDrafts.get('support-draft-ticket')?.submissionOperationId
    ).toEqual(expect.any(String));
    const post = mockRequest.mock.calls.find(
      ([, init]) => init?.method === 'POST'
    )!;
    expect(String(post[0])).toBe(
      `https://support.example.test/api/v1/${category === 'feedback' ? 'feedback' : 'support/tickets'}`
    );
    expect(JSON.parse(String(post[1]?.body))).toMatchObject(
      category === 'feedback'
        ? { subject: 'Help with the app', body: 'The screen does not open.' }
        : { subject: 'Help with the app', message: 'The screen does not open.' }
    );
    await act(async () => {
      accept(
        response(
          category === 'feedback'
            ? {}
            : {
                id: id(20),
                categoryId: id(21),
                subject: 'Help with the app',
                status: 'waiting_support',
                priority: 'normal',
                lastMessageAt: at,
                closedAt: null,
                version: 1,
                createdAt: at,
                messages: [],
                nextCursor: null,
                hasMore: false
              }
        )
      );
    });
    expect(await screen.findByText('Message sent')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: translate('support.form.submit') })
    ).toBeNull();
    // The confirmed screen remains mounted beyond the existing autosave debounce.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(mockDrafts.has('support-draft-ticket')).toBe(false);
    expect(
      mockRequest.mock.calls.filter(([, init]) => init?.method === 'POST')
    ).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  }
);

const at = '2026-11-04T00:00:00.000Z';
function id(suffix: number) {
  return `11000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
}
function response(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response;
}
