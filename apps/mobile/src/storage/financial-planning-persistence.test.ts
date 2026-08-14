import {
  financialPlanningSeed,
  fixtureSalaryProfile,
  fixtureSalaryReceipt
} from '@/test-utils/financial-planning-fixtures';
import { FinancialPlanningRepository } from './financial-planning-repository';

const mockRunAsync = jest.fn(async (..._arguments: unknown[]) => ({}));
const mockExecAsync = jest.fn(async (..._arguments: unknown[]) => undefined);
const mockGetAllAsync = jest.fn(async (sql: string) =>
  sql.includes('planning_salary_profiles')
    ? [{ payload: JSON.stringify(fixtureSalaryProfile) }]
    : []
);
const mockDatabase = {
  runAsync: mockRunAsync,
  execAsync: mockExecAsync,
  getAllAsync: mockGetAllAsync
};

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(async (_database, task) => task(mockDatabase))
}));

beforeEach(() => jest.clearAllMocks());

it('does not hydrate or delete report schedule drafts owned by reports', async () => {
  const repository = new FinancialPlanningRepository(financialPlanningSeed);
  await repository.hydrate();
  await repository.persistAll();

  expect(mockGetAllAsync).toHaveBeenCalledWith(
    "SELECT payload FROM planning_drafts WHERE kind != 'report_schedule'"
  );
  expect(mockExecAsync).toHaveBeenCalledWith(
    expect.stringContaining("DELETE FROM planning_drafts WHERE kind != 'report_schedule'")
  );
});

it('replays a durable salary receipt operation after restart without duplicate owner effect', async () => {
  mockGetAllAsync.mockImplementation(async (sql: string) => {
    if (sql.includes('operation_id IS NOT NULL')) {
      return [
        {
          operation_id: fixtureSalaryReceipt.operationId,
          payload: JSON.stringify(fixtureSalaryReceipt)
        }
      ];
    }
    if (sql.includes('planning_salary_profiles')) {
      return [{ payload: JSON.stringify(fixtureSalaryProfile) }];
    }
    if (sql.includes('planning_salary_receipts')) {
      return [{ payload: JSON.stringify(fixtureSalaryReceipt) }];
    }
    return [];
  });
  const repository = new FinancialPlanningRepository();
  await repository.hydrate();

  const replay = repository.confirmSalaryReceipt(
    {
      salaryProfileId: fixtureSalaryReceipt.salaryProfileId,
      transactionId: fixtureSalaryReceipt.transactionId,
      expectedOccurrenceDate: fixtureSalaryReceipt.expectedOccurrenceDate,
      receivedDate: fixtureSalaryReceipt.receivedDate,
      operationId: fixtureSalaryReceipt.operationId,
      replacesReceiptId: null
    },
    fixtureSalaryReceipt.operationId
  );

  expect(replay).toEqual(fixtureSalaryReceipt);
  expect(repository.listSalaryReceipts()).toHaveLength(1);
});
