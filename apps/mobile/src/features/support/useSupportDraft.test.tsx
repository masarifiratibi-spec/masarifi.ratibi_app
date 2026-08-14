import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSupportDraft } from './useSupportDraft';

const service = {
  saveDraft: jest.fn(),
  loadDraft: jest.fn(),
  discardDraft: jest.fn()
};

beforeEach(() => {
  jest.clearAllMocks();
  service.saveDraft.mockImplementation(async (draft) => ({ ...draft, status: 'draft', updatedAt: 1 }));
  service.loadDraft.mockResolvedValue(null);
  service.discardDraft.mockResolvedValue(undefined);
});

test('loads an existing draft and debounces saves without overwriting submitted state', async () => {
  service.loadDraft.mockResolvedValue({ id: 'draft-1', mode: 'ticket', category: 'technical', subject: 'Loaded', description: 'Existing draft', ticketId: null, context: null, status: 'draft', updatedAt: 1 });

  const hook = renderHook(() => useSupportDraft({ draftId: 'draft-1', mode: 'ticket', service, debounceMs: 1 }));
  await waitFor(() => expect(hook.result.current.values.subject).toBe('Loaded'));

  act(() => hook.result.current.update({ subject: 'Edited' }));
  await waitFor(() => expect(service.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Edited' })));

  act(() => hook.result.current.markSubmitted());
  act(() => hook.result.current.update({ subject: 'Ignored after submit' }));
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(service.saveDraft).not.toHaveBeenCalledWith(expect.objectContaining({ subject: 'Ignored after submit' }));
});

test('does not resurrect a draft from an already scheduled save after submit success', async () => {
  const hook = renderHook(() => useSupportDraft({ draftId: 'draft-race', mode: 'ticket', service, debounceMs: 10 }));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  act(() => hook.result.current.update({ subject: 'Typed right before submit' }));
  act(() => hook.result.current.markSubmitted());
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(service.saveDraft).not.toHaveBeenCalledWith(expect.objectContaining({ subject: 'Typed right before submit' }));
});

test('preserves input after validation/offline save failure and retries later', async () => {
  service.saveDraft.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'offline' })).mockImplementation(async (draft) => ({ ...draft, status: 'draft', updatedAt: 2 }));
  const hook = renderHook(() => useSupportDraft({ draftId: 'draft-2', mode: 'ticket', service, debounceMs: 1 }));

  act(() => hook.result.current.update({ subject: 'Keep me', description: 'Preserved text' }));
  await waitFor(() => expect(hook.result.current.safeFailure).toBe('offline'));
  expect(hook.result.current.values.subject).toBe('Keep me');

  await act(async () => hook.result.current.retrySave());
  expect(service.saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ subject: 'Keep me', description: 'Preserved text' }));
  expect(hook.result.current.safeFailure).toBeNull();
});

test('discards explicitly and clears restored values', async () => {
  service.loadDraft.mockResolvedValue({ id: 'draft-3', mode: 'ticket', category: 'technical', subject: 'Loaded', description: 'Existing draft', ticketId: null, context: null, status: 'draft', updatedAt: 1 });
  const hook = renderHook(() => useSupportDraft({ draftId: 'draft-3', mode: 'ticket', service, debounceMs: 1 }));
  await waitFor(() => expect(hook.result.current.values.subject).toBe('Loaded'));

  await act(async () => hook.result.current.discard());

  expect(service.discardDraft).toHaveBeenCalledWith('draft-3');
  expect(hook.result.current.values.subject).toBe('');
});
