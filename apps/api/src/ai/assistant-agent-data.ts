import { Injectable } from '@nestjs/common';
import { PoolService } from '../platform/database/pool.service';

const tools = [
  'overview',
  'accounts',
  'transactions',
  'summary',
  'planning',
  'profile',
  'tracking',
] as const;
export interface AssistantDataQuery {
  tool: (typeof tools)[number];
  kind?:
    'expense' | 'income' | 'transfer' | 'refund' | 'opening' | 'reversal' | 'adjustment' | null;
  startDate?: string | null;
  endDate?: string | null;
  currency?: string | null;
  minAmountMinor?: string | null;
  maxAmountMinor?: string | null;
  account?: string | null;
  category?: string | null;
  search?: string | null;
  sort?: 'latest' | 'largest';
  limit?: number;
  offset?: number;
}
export interface AssistantDataResult {
  observedAt: string;
  ledgerVersion: number;
  data: Record<string, unknown>;
  aliases: Array<{
    alias: string;
    kind: string;
    id: string;
    version: number;
    data: Record<string, unknown>;
  }>;
}
export const ASSISTANT_DATA_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tool'],
  properties: {
    tool: { type: 'string', enum: tools },
    kind: {
      type: ['string', 'null'],
      enum: ['expense', 'income', 'transfer', 'refund', 'opening', 'reversal', 'adjustment', null],
    },
    startDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    endDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    currency: { type: ['string', 'null'], pattern: '^[A-Z]{3}$' },
    minAmountMinor: { type: ['string', 'null'], pattern: '^(0|[1-9][0-9]{0,15})$' },
    maxAmountMinor: { type: ['string', 'null'], pattern: '^(0|[1-9][0-9]{0,15})$' },
    account: { type: ['string', 'null'], minLength: 1, maxLength: 160 },
    category: { type: ['string', 'null'], minLength: 1, maxLength: 160 },
    search: { type: ['string', 'null'], minLength: 1, maxLength: 160 },
    sort: { type: 'string', enum: ['latest', 'largest'] },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
    offset: { type: 'integer', minimum: 0, maximum: 10000 },
  },
} as const;

export function parseAssistantDataQuery(value: unknown): AssistantDataQuery {
  const invalid = (): never => {
    throw new Error('ASSISTANT_DATA_QUERY_INVALID');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const query = value as Record<string, unknown>;
  if (Object.keys(query).some((key) => !Object.hasOwn(ASSISTANT_DATA_QUERY_SCHEMA.properties, key)))
    return invalid();
  if (!tools.includes(query.tool as AssistantDataQuery['tool'])) return invalid();
  for (const key of ['startDate', 'endDate']) {
    const date = query[key];
    if (date == null) continue;
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      return invalid();
  }
  if (
    typeof query.startDate === 'string' &&
    typeof query.endDate === 'string' &&
    query.startDate > query.endDate
  )
    return invalid();
  if (
    query.kind != null &&
    (typeof query.kind !== 'string' ||
      !['expense', 'income', 'transfer', 'refund', 'opening', 'reversal', 'adjustment'].includes(
        query.kind,
      ))
  )
    return invalid();
  if (
    query.currency != null &&
    (typeof query.currency !== 'string' || !/^[A-Z]{3}$/.test(query.currency))
  )
    return invalid();
  for (const key of ['minAmountMinor', 'maxAmountMinor']) {
    const amount = query[key];
    if (
      amount != null &&
      (typeof amount !== 'string' ||
        !/^(0|[1-9][0-9]{0,15})$/.test(amount) ||
        typeof query.currency !== 'string')
    )
      return invalid();
  }
  if (
    typeof query.minAmountMinor === 'string' &&
    typeof query.maxAmountMinor === 'string' &&
    BigInt(query.minAmountMinor) > BigInt(query.maxAmountMinor)
  )
    return invalid();
  for (const key of ['account', 'category', 'search']) {
    const text = query[key];
    if (
      text != null &&
      (typeof text !== 'string' ||
        text !== text.trim() ||
        text.length < 1 ||
        text.length > 160 ||
        Array.from(text).some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ))
    )
      return invalid();
  }
  if (query.sort !== undefined && query.sort !== 'latest' && query.sort !== 'largest')
    return invalid();
  for (const [key, min, max] of [
    ['limit', 1, 50],
    ['offset', 0, 10000],
  ] as const) {
    if (
      query[key] !== undefined &&
      (!Number.isInteger(query[key]) || Number(query[key]) < min || Number(query[key]) > max)
    )
      return invalid();
  }
  return { ...query } as unknown as AssistantDataQuery;
}

@Injectable()
export class AssistantAgentData {
  constructor(private readonly pool: PoolService) {}

  async read(
    jobId: string,
    claimToken: string,
    query: AssistantDataQuery,
  ): Promise<AssistantDataResult> {
    const bounded = parseAssistantDataQuery(query);
    return this.pool.withClient(async (client) => {
      await client.query('begin isolation level repeatable read read only');
      try {
        await client.query('set local role masarifi_worker');
        await client.query("select set_config('request.jwt.claims','{}',true)");
        const row = await client.query<{ result: AssistantDataResult }>(
          'select private.read_assistant_agent_data($1::uuid,$2::uuid,$3::jsonb) result',
          [jobId, claimToken, JSON.stringify(bounded)],
        );
        const result = row.rows[0]?.result;
        if (
          !result ||
          !Array.isArray(result.aliases) ||
          Buffer.byteLength(JSON.stringify(result), 'utf8') > 65536
        )
          throw new Error('ASSISTANT_DATA_RESULT_INVALID');
        if (
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
            JSON.stringify(result.data),
          )
        )
          throw new Error('ASSISTANT_DATA_IDENTIFIER_LEAK');
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }
}
