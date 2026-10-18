import { workerErrorFields } from '../platform/observability/worker-error';
import { HttpException } from '@nestjs/common';

export function permanentVoiceFailure(error: unknown): string | null {
  const response = error instanceof HttpException ? error.getResponse() : undefined;
  const code =
    response && typeof response === 'object' && 'code' in response ? response.code : undefined;
  const fields = workerErrorFields(error);
  const reason = typeof code === 'string' ? code : fields.exception.reason;
  return [
    'AUTH_TOKEN_INVALID',
    'PROFILE_INACTIVE',
    'FINANCIAL_ACCESS_DENIED',
    'VOICE_COMMAND_INTEGRITY_INVALID',
    'VOICE_SCOPE_INVALID',
  ].includes(reason)
    ? reason
    : null;
}

// Retry known service availability failures, never scope or authentication rejections.
export function isTransientVoiceError(error: unknown): boolean {
  const fields = workerErrorFields(error);
  if (fields.causeTruncated) return false;
  return fields.exceptionChain.every((item, index) =>
    index < fields.exceptionChain.length - 1
      ? item.reason === 'unclassified' && !item.code
      : [
          'Query read timeout',
          'DATABASE_QUERY_TIMEOUT',
          'Connection terminated unexpectedly',
          'VOICE_STORAGE_UNAVAILABLE',
          'AI_DATABASE_UNAVAILABLE',
          'AI_TEMPORARILY_UNAVAILABLE',
          'Connection terminated',
          'timeout exceeded when trying to connect',
        ].includes(item.reason) ||
        [
          'ECONNRESET',
          'ECONNREFUSED',
          'ETIMEDOUT',
          'EPIPE',
          'EAI_AGAIN',
          'ENOTFOUND',
          '08000',
          '08001',
          '08003',
          '08006',
          '08007',
          '53300',
          '57014',
          '57P01',
          '57P02',
          '57P03',
          '40001',
          '40P01',
        ].includes(item.code ?? ''),
  );
}
