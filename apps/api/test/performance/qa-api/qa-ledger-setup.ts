import { HttpException } from '@nestjs/common';

import { ClerkAuthGuard, type ClerkPrincipal } from '../../../src/identity/clerk-auth.guard';
import { hashIdempotencyKey } from '../../../src/ledger/idempotency';
import {
  normalizeCreateTransaction,
  normalizeTransfer,
  normalizeReverse,
  normalizeRevision,
  normalizeTransactionId,
} from '../../../src/ledger/ledger.dto';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { LedgerService, type LedgerMutation } from '../../../src/ledger/ledger.service';

export type QaSetupOperation =
  | { kind: 'createTransaction' | 'transfer'; body: unknown }
  | { kind: 'reverseTransaction' | 'reviseTransaction'; transactionId: string; body: unknown };

export function normalizeQaSetupOperation(input: QaSetupOperation) {
  switch (input.kind) {
    case 'createTransaction':
      return {
        operation: input.kind,
        scope: 'ledger.transaction.create',
        status: 201,
        command: normalizeCreateTransaction(input.body),
      } as const;
    case 'transfer':
      return {
        operation: input.kind,
        scope: 'ledger.transfer.create',
        status: 201,
        command: normalizeTransfer(input.body),
      } as const;
    case 'reverseTransaction': {
      const command: Record<string, unknown> & { transactionId: string } = {
        transactionId: normalizeTransactionId(input.transactionId),
        ...normalizeReverse(input.body),
      };
      return {
        operation: input.kind,
        scope: 'ledger.transaction.reverse',
        status: 201,
        command,
      } as const;
    }
    case 'reviseTransaction':
      return {
        operation: input.kind,
        scope: 'ledger.transaction.revise',
        status: 200,
        command: {
          transactionId: normalizeTransactionId(input.transactionId),
          ...normalizeRevision(input.body),
        },
      } as const;
    default:
      throw new Error('QA_SETUP_OPERATION_INVALID');
  }
}

type PreparedOperation = ReturnType<typeof normalizeQaSetupOperation>;
const owners = new Set([
  'perf_20261102_t0',
  'perf_20261102_t1000',
  'perf_20261102_t10000',
  'perf_20261102_secondary',
  'perf_20261102_admission',
]);

/** Fixture preparation only: request-rate admission is intentionally not a setup workload. */
export class QaLedgerSetup {
  constructor(
    private readonly guard: ClerkAuthGuard,
    private readonly repository: LedgerRepository,
    private readonly ledger: LedgerService,
  ) {}

  async apply(input: {
    token: string;
    expectedOwner: string;
    operation: QaSetupOperation;
    idempotencyKey: string;
    requestId: string;
  }): Promise<unknown> {
    const principal = await this.guard.verifyToken(input.token);
    if (!owners.has(input.expectedOwner) || principal.userId !== input.expectedOwner)
      throw new Error('QA_SETUP_OWNER_MISMATCH');
    this.validateKey(input.idempotencyKey);
    const prepared = this.normalize(input.operation);
    const mutation: LedgerMutation = {
      ...prepared,
      principal,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
    };
    const replay = await this.repository.replayCompleted(mutation);
    if (replay !== undefined) return replay;
    await this.assertFinancialAdmission(principal, prepared);
    return this.repository.mutate(mutation);
  }

  private validateKey(key: string): void {
    try {
      hashIdempotencyKey(key);
    } catch {
      throw new HttpException({ code: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
    }
  }

  private normalize(input: QaSetupOperation): PreparedOperation {
    try {
      return normalizeQaSetupOperation(input);
    } catch {
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    }
  }

  private async assertFinancialAdmission(
    principal: ClerkPrincipal,
    prepared: PreparedOperation,
  ): Promise<void> {
    const { operation, command } = prepared;
    if (operation === 'createTransaction') {
      this.ledger.assertTrackingRecentAuth(principal, command.currency, command.amountMinor);
      return;
    }
    if (operation === 'transfer') {
      const amount = Number(command.amountMinor),
        fee = Number(command.feeMinor);
      this.ledger.assertTrackingRecentAuth(
        principal,
        String(command.currency),
        amount > Number.MAX_SAFE_INTEGER - fee ? Number.MAX_SAFE_INTEGER : amount + fee,
      );
      return;
    }
    const current = await this.repository.effect(principal, command.transactionId);
    if (current.version !== command.expectedVersion)
      throw new HttpException({ code: 'VERSION_CONFLICT', currentVersion: current.version }, 409);
    const next =
      operation === 'reviseTransaction' && typeof command.patch.amountMinor === 'number'
        ? command.patch.amountMinor
        : current.amountMinor;
    const effect =
      operation === 'reviseTransaction'
        ? Math.max(current.amountMinor + current.feeMinor, next)
        : current.amountMinor + current.feeMinor;
    this.ledger.assertTrackingRecentAuth(principal, current.currency, effect);
  }
}
