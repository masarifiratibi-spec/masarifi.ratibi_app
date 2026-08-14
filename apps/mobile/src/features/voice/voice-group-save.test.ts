import { proposalToTransactionInput } from '@/domain/voice-capture';
import { createMockCoreFinanceService } from '@/services/mocks/core-finance-service';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { fixtureAccounts, fixtureCategories } from '@/test-utils/core-finance-fixtures';

it('saves every selected proposal with one operation id', async () => {
  const group = fixtureProposalGroup({
    scenario: 'multiple', sessionId: 'group', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  });
  const service = createMockCoreFinanceService(new CoreFinanceRepository({
    accounts: fixtureAccounts, categories: fixtureCategories
  }));
  const result = await service.createTransactionsAtomically(
    group.proposals.map(proposalToTransactionInput), group.id, 'voice'
  );
  expect(result.value).toHaveLength(2);
  expect(result.value.every((item) => item.source === 'voice')).toBe(true);
});
