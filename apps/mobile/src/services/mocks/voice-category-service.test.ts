import { createVoiceCategoryService } from './voice-category-service';
import type { VoiceCategoryPreferenceRepository } from '@/storage/voice-category-preference-repository';

function repository(categoryId: string | null) {
  return {
    get: jest.fn(async () => categoryId ? { categoryId } : null),
    save: jest.fn(async (_merchant: string, id: string) => ({ categoryId: id }))
  } as unknown as VoiceCategoryPreferenceRepository;
}

it('applies user, merchant, keyword, then smart precedence', async () => {
  expect((await createVoiceCategoryService(repository('travel')).suggest('Netflix', '', 'shopping')).source)
    .toBe('user');
  const service = createVoiceCategoryService(repository(null));
  expect((await service.suggest('Netflix', '', 'shopping')).source).toBe('merchant');
  expect((await service.suggest('Unknown', 'coffee order', 'shopping')).source).toBe('keyword');
  expect((await service.suggest('Unknown', 'misc', 'shopping')).source).toBe('smart');
});
