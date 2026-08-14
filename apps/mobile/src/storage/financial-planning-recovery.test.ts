import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';

it('restores and discards durable planning drafts', async () => {
  const service = createSeededFinancialPlanningService();
  await service.saveDraft({
    id: 'draft-salary',
    kind: 'salary',
    entityId: null,
    payload: { sourceName: 'Demo' },
    status: 'editing',
    updatedAt: 1
  });
  expect(await service.loadDraft('draft-salary')).not.toBeNull();
  await service.discardDraft('draft-salary');
  expect(await service.loadDraft('draft-salary')).toBeNull();
});
