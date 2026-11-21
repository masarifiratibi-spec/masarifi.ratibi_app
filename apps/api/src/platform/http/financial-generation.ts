import { AsyncLocalStorage } from 'node:async_hooks';

export const financialGeneration = new AsyncLocalStorage<string>();

export function generationHeader(value: string | undefined): string {
  return value && /^(0|[1-9][0-9]{0,9})$/.test(value) ? value : '';
}
