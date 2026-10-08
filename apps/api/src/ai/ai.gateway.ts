import { withAiAbort } from './ai.abort';
import { createHash } from 'node:crypto';
import type { SafeLogFields } from '../platform/observability/platform-logger';
import { VERTEX_VOICE_OUTPUT_SCHEMA, normalizeVertexVoiceOutput } from './voice-provider-schema';
export interface EffectiveAiRoute {
  workload: string;
  primary: { modelId: string; provider: string };
  fallbacks: Array<{ modelId: string; provider: string }>;
  providerAllowlist: string[];
  zdrRequired: boolean;
  maxPrice: { prompt: string; completion: string };
  limits: { inputTokens: number; outputTokens: number; timeoutMs: number };
  prompt: { template: string; schemaVersion: number };
  safetyRules: Array<{
    key: string;
    type: 'input_block' | 'output_block' | 'field_limit' | 'action_allowlist' | 'evidence_limit';
    configuration: Record<string, unknown>;
  }>;
}

export interface AiCompletion<T> {
  value: T;
  model: string;
  provider: string;
  fallbackUsed: boolean;
  generationId: string;
  usage: { inputTokens: number; outputTokens: number; cost: number };
  latencyMs: number;
}

export class AiGatewayError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false,
    public readonly diagnostic?: SafeLogFields,
  ) {
    super(code);
    this.name = 'AiGatewayError';
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Candidate = EffectiveAiRoute['primary'];
interface CompletionInput<T> {
  route: EffectiveAiRoute;
  userContent: unknown;
  schema: Record<string, unknown>;
  parse: (value: unknown) => T;
  requestId: string;
  voiceBatch?: boolean;
  signal?: AbortSignal;
  beforeDispatch?: (candidate: Candidate) => Promise<void>;
  onReceipt?: (receipt: Omit<AiCompletion<T>, 'value'>) => Promise<void>;
  onDispatchFailure?: (responseReceived: boolean) => Promise<void>;
}

export class AiGateway {
  private static readonly MAX_REQUEST_BYTES = 18 * 1024 * 1024;
  private readonly fetcher: Fetcher;
  private readonly now: () => number;
  private failures: number[] = [];
  private openUntil = 0;
  private probing = false;

  constructor(
    private readonly options: { apiKey?: string; fetcher?: Fetcher; now?: () => number },
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async complete<T>(input: CompletionInput<T>): Promise<AiCompletion<T>> {
    if (input.signal?.aborted) throw new AiGatewayError('AI_WORK_CANCELLED');
    if (!this.options.apiKey) throw new AiGatewayError('AI_UNAVAILABLE');
    this.assertRoute(input.route);
    this.enterCircuit();
    const startedAt = this.now();
    const deadline = startedAt + input.route.limits.timeoutMs;
    const candidates = [input.route.primary, ...input.route.fallbacks].slice(0, 2);
    let last: AiGatewayError | undefined;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (!candidate) break;
      try {
        if (input.signal?.aborted) throw new AiGatewayError('AI_WORK_CANCELLED');
        const result = await this.attempt(input, candidate, deadline, index > 0, startedAt);
        this.onSuccess();
        return result;
      } catch (error) {
        last =
          error instanceof AiGatewayError
            ? error
            : new AiGatewayError('AI_TEMPORARILY_UNAVAILABLE', true);
        this.onFailure(last.retryable);
        if (!last.retryable || index === candidates.length - 1) break;
      }
    }
    throw last ?? new AiGatewayError('AI_TEMPORARILY_UNAVAILABLE', true);
  }

  private async attempt<T>(
    input: CompletionInput<T>,
    candidate: Candidate,
    deadline: number,
    fallbackUsed: boolean,
    startedAt: number,
  ): Promise<AiCompletion<T>> {
    const remaining = deadline - this.now();
    if (remaining <= 0) throw new AiGatewayError('AI_TEMPORARILY_UNAVAILABLE', true);
    const apiKey = this.options.apiKey;
    if (!apiKey) throw new AiGatewayError('AI_UNAVAILABLE');
    const controller = new AbortController();
    const onAbort = () => {
      controller.abort();
    };
    input.signal?.addEventListener('abort', onAbort, { once: true });
    const fullTimer = setTimeout(() => {
      controller.abort();
    }, remaining);
    const dispatchState = { dispatched: false, responseReceived: false, accounted: false };
    const voice = input.route.workload === 'voice_transcription';
    try {
      return await withAiAbort(controller.signal, async () => {
        const vertexVoiceLite =
          input.route.workload === 'voice_transcription' &&
          candidate.modelId === 'google/gemini-3.5-flash-lite' &&
          candidate.provider === 'google-vertex';
        const completionParameters =
          candidate.modelId === 'openai/gpt-6-luna'
            ? { max_completion_tokens: input.route.limits.outputTokens }
            : {
                max_tokens: input.route.limits.outputTokens,
                ...(vertexVoiceLite ? {} : { temperature: 0 }),
              };
        const body = JSON.stringify({
          model: candidate.modelId,
          messages: [
            { role: 'system', content: input.route.prompt.template },
            { role: 'user', content: input.userContent },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: `${input.route.workload}_v${input.route.prompt.schemaVersion.toString()}`,
              strict: true,
              schema:
                vertexVoiceLite && !input.voiceBatch ? VERTEX_VOICE_OUTPUT_SCHEMA : input.schema,
            },
          },
          ...completionParameters,
          stream: false,
          provider: {
            only: [vertexVoiceLite ? 'google-vertex/global' : candidate.provider],
            allow_fallbacks: false,
            require_parameters: true,
            data_collection: 'deny',
            zdr: true,
            max_price: {
              prompt: Number((Number(input.route.maxPrice.prompt) * 1_000_000).toFixed(8)),
              completion: Number((Number(input.route.maxPrice.completion) * 1_000_000).toFixed(8)),
            },
          },
        });
        if (new TextEncoder().encode(body).length > AiGateway.MAX_REQUEST_BYTES)
          throw new AiGatewayError('AI_SCHEMA_INVALID');
        this.assertActive(controller.signal);
        try {
          await input.beforeDispatch?.(candidate);
        } catch {
          throw new AiGatewayError('AI_DISPATCH_REJECTED');
        }
        this.assertActive(controller.signal);
        dispatchState.dispatched = true;
        const response = await this.fetcher('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            'x-title': 'Masarifi',
            'x-request-id': input.requestId,
          },
          body,
        });
        dispatchState.responseReceived = true;
        if (!response.ok) {
          const diagnostic = await rejectionDiagnostic(
            response,
            input.requestId,
            controller.signal,
          );
          throw new AiGatewayError(
            response.status === 429 || response.status >= 500
              ? 'AI_TEMPORARILY_UNAVAILABLE'
              : 'AI_UNAVAILABLE',
            response.status === 429 || response.status >= 500,
            diagnostic,
          );
        }
        if (!response.headers.get('content-type')?.toLowerCase().includes('application/json'))
          throw new AiGatewayError('AI_SCHEMA_INVALID');
        const text = await boundedText(response, 262_144, controller.signal);
        let decodedEnvelope: unknown;
        try {
          decodedEnvelope = JSON.parse(text);
        } catch {
          throw new AiGatewayError('AI_SCHEMA_INVALID', !voice);
        }
        if (
          voice &&
          (!decodedEnvelope ||
            typeof decodedEnvelope !== 'object' ||
            Array.isArray(decodedEnvelope))
        )
          throw new AiGatewayError('AI_SCHEMA_INVALID');
        const envelope = decodedEnvelope as Record<string, unknown>;
        const usage = this.usage(envelope.usage);
        const maximumCost =
          usage.inputTokens * Number(input.route.maxPrice.prompt) +
          usage.outputTokens * Number(input.route.maxPrice.completion);
        if (
          usage.inputTokens > input.route.limits.inputTokens ||
          usage.outputTokens > input.route.limits.outputTokens ||
          usage.cost > maximumCost + 0.00000001 ||
          (voice &&
            (typeof envelope.model !== 'string' ||
              envelope.model.trim().length === 0 ||
              typeof envelope.id !== 'string' ||
              envelope.id.trim().length === 0)) ||
          (!voice && typeof envelope.model === 'string' && envelope.model !== candidate.modelId)
        ) {
          throw new AiGatewayError('AI_SCHEMA_INVALID');
        }
        const receipt = {
          model: typeof envelope.model === 'string' ? envelope.model : candidate.modelId,
          provider: candidate.provider,
          fallbackUsed,
          generationId: typeof envelope.id === 'string' ? envelope.id : input.requestId,
          usage,
          latencyMs: Math.max(0, this.now() - startedAt),
        };
        await input.onReceipt?.(receipt);
        dispatchState.accounted = true;
        if (voice && envelope.model !== candidate.modelId)
          throw schemaFailure(input.requestId, 'provider_identity', 'model', { keyword: 'const' });
        const choices = Array.isArray(envelope.choices) ? (envelope.choices as unknown[]) : [];
        const choice = choices[0];
        if (!choice || typeof choice !== 'object' || choices.length !== 1)
          throw schemaFailure(input.requestId, 'provider_completion', 'choices', {
            keyword: 'oneItem',
          });
        const finishReason: unknown = Reflect.get(choice, 'finish_reason');
        if (finishReason === 'length') throw new AiGatewayError('AI_OUTPUT_TRUNCATED');
        if (finishReason === 'content_filter') throw new AiGatewayError('AI_REFUSED');
        if (
          finishReason !== 'stop' &&
          (finishReason !== undefined || input.route.workload === 'voice_transcription')
        )
          throw schemaFailure(input.requestId, 'provider_completion', 'choices.finish_reason', {
            keyword: 'enum',
          });
        const message: unknown = Reflect.get(choice, 'message');
        if (message && typeof message === 'object' && Reflect.get(message, 'refusal'))
          throw new AiGatewayError('AI_REFUSED');
        const content =
          'message' in choice
            ? (choice as { message?: { content?: unknown } }).message?.content
            : undefined;
        if (typeof content !== 'string' || content.length > 65_536) {
          throw schemaFailure(input.requestId, 'provider_content', 'choices.message.content', {
            keyword: 'typeOrSize',
            retryable: !voice,
          });
        }
        let decoded: unknown;
        try {
          decoded = JSON.parse(content);
        } catch {
          throw schemaFailure(input.requestId, 'provider_content', 'choices.message.content', {
            keyword: 'json',
            retryable: !voice,
          });
        }
        let value: T;
        try {
          value = input.parse(
            vertexVoiceLite && !input.voiceBatch ? normalizeVertexVoiceOutput(decoded) : decoded,
          );
        } catch (error) {
          // Only closed field/constraint names survive; never retain provider output or values.
          const cause = error instanceof Error ? diagnosticObject(error.cause) : {};
          const field = ['$', 'complete', 'language', 'events'].includes(String(cause.field))
            ? String(cause.field)
            : '$';
          const keyword = [
            'type',
            'required',
            'additionalProperties',
            'const',
            'enum',
            'maxItems',
            'maxBytes',
          ].includes(String(cause.keyword))
            ? String(cause.keyword)
            : 'canonical';
          throw schemaFailure(input.requestId, 'provider_output', field, {
            keyword,
            retryable: !voice,
          });
        }
        return {
          value,
          model: typeof envelope.model === 'string' ? envelope.model : candidate.modelId,
          provider: candidate.provider,
          fallbackUsed,
          generationId: typeof envelope.id === 'string' ? envelope.id : input.requestId,
          usage,
          latencyMs: Math.max(0, this.now() - startedAt),
        };
      });
    } catch (error) {
      if (dispatchState.dispatched && !dispatchState.accounted)
        await input.onDispatchFailure?.(dispatchState.responseReceived);
      if (input.signal?.aborted) throw new AiGatewayError('AI_WORK_CANCELLED');
      if (error instanceof AiGatewayError) throw error;
      throw new AiGatewayError('AI_TEMPORARILY_UNAVAILABLE', true);
    } finally {
      clearTimeout(fullTimer);
      input.signal?.removeEventListener('abort', onAbort);
    }
  }

  private assertActive(signal: AbortSignal) {
    if (signal.aborted) throw new AiGatewayError('AI_WORK_CANCELLED');
  }

  private usage(value: unknown): AiCompletion<unknown>['usage'] {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new AiGatewayError('AI_USAGE_ACCOUNTING_INCOMPLETE');
    const usage = value as Record<string, unknown>;
    const inputTokens = accountingInteger(usage.prompt_tokens);
    const outputTokens = accountingInteger(usage.completion_tokens);
    const cost = accountingNumber(usage.cost);
    return { inputTokens, outputTokens, cost };
  }

  private assertRoute(route: EffectiveAiRoute): void {
    const candidates = [route.primary, ...route.fallbacks];
    const inputRule = route.safetyRules.find(({ type }) => type === 'input_block')?.configuration;
    const outputRule = route.safetyRules.find(({ type }) => type === 'output_block')?.configuration;
    const forbidden = outputRule?.forbiddenKeys;
    if (
      !route.zdrRequired ||
      candidates.length === 0 ||
      candidates.length > 5 ||
      new Set(candidates.map((item) => item.modelId)).size !== candidates.length ||
      candidates.some((item) => !route.providerAllowlist.includes(item.provider)) ||
      route.limits.outputTokens < 1 ||
      route.limits.inputTokens < 1 ||
      route.limits.timeoutMs < 100 ||
      !decimal(route.maxPrice.prompt) ||
      !decimal(route.maxPrice.completion) ||
      inputRule?.denyControl !== true ||
      inputRule.denyBidiControls !== true ||
      !Number.isInteger(inputRule.maxUtf8Bytes) ||
      Number(inputRule.maxUtf8Bytes) < 1 ||
      Number(inputRule.maxUtf8Bytes) > 8192 ||
      !Array.isArray(forbidden) ||
      !['tool', 'tools', 'sql', 'url', 'callback', 'authorization', 'secret'].every((key) =>
        forbidden.includes(key),
      ) ||
      (route.workload === 'financial_assistant' &&
        (!route.safetyRules.some(({ type }) => type === 'action_allowlist') ||
          !route.safetyRules.some(({ type }) => type === 'evidence_limit')))
    ) {
      throw new AiGatewayError('AI_ROUTE_POLICY_INVALID');
    }
  }

  private enterCircuit(): void {
    if (this.openUntil === 0) return;
    if (this.now() < this.openUntil || this.probing) {
      throw new AiGatewayError('AI_TEMPORARILY_UNAVAILABLE', true);
    }
    this.probing = true;
  }

  private onSuccess(): void {
    this.failures = [];
    this.openUntil = 0;
    this.probing = false;
  }

  private onFailure(retryable: boolean): void {
    this.probing = false;
    if (!retryable) return;
    const cutoff = this.now() - 60_000;
    this.failures = [...this.failures.filter((time) => time >= cutoff), this.now()];
    if (this.failures.length >= 5) this.openUntil = this.now() + 30_000;
  }
}

function schemaFailure(
  requestId: string,
  failureStage: string,
  field: string,
  constraint: { keyword: string; retryable?: boolean },
): AiGatewayError {
  return new AiGatewayError('AI_SCHEMA_INVALID', constraint.retryable ?? false, {
    failureStage,
    ...(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId) ? { requestId } : {}),
    rejectedFields: [field],
    rejectedKeywords: [constraint.keyword],
  });
}

async function boundedText(
  response: Response,
  maximumBytes: number,
  signal: AbortSignal,
): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  try {
    const decoder = new TextDecoder();
    let total = 0;
    let result = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      total += value.byteLength;
      if (total > maximumBytes) {
        void reader.cancel().catch(() => undefined);
        throw new AiGatewayError('AI_SCHEMA_INVALID');
      }
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

const providerCodes = new Set([
  'INVALID_ARGUMENT',
  'FAILED_PRECONDITION',
  'PERMISSION_DENIED',
  'RESOURCE_EXHAUSTED',
  'UNAUTHENTICATED',
  'NOT_FOUND',
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
  'INTERNAL',
  'UNKNOWN',
]);
const requestFields = new Set([
  'GenerateContentRequest',
  'generation_config',
  'generationConfig',
  'response_schema',
  'responseSchema',
  'response_json_schema',
  'responseJsonSchema',
  'response_mime_type',
  'responseMimeType',
  'response_format',
  'json_schema',
  'schema',
  'properties',
  'items',
  'value',
  'type',
  'enum',
  'const',
  'oneOf',
  'anyOf',
  'allOf',
  'additionalProperties',
  'additional_properties',
  'one_of',
  'any_of',
  'all_of',
  'min_items',
  'max_items',
  'min_length',
  'max_length',
  'required',
  'format',
  'pattern',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'nullable',
  'description',
  'contents',
  'parts',
  'inline_data',
  'inlineData',
  'mime_type',
  'mimeType',
  'data',
  'messages',
  'content',
  'input_audio',
  'audio',
  'model',
  'max_tokens',
  'maxOutputTokens',
  'max_output_tokens',
  'temperature',
  'schemaVersion',
  'outcome',
  'transcript',
  'language',
  'confidence',
  'proposal',
  'unsupportedReason',
  'amountMinor',
  'currency',
  'categoryId',
  'accountId',
  'date',
  'merchant',
  'note',
  'kind',
]);

function diagnosticObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recognizedField(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 256 &&
    /^[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*|\[(?:\d{1,2}|[A-Za-z_][A-Za-z_0-9]*)\])*$/.test(
      value,
    ) &&
    value
      .replace(/\[(\d+|[A-Za-z_][A-Za-z_0-9]*)\]/g, (_match, part: string) =>
        /^\d+$/.test(part) ? '' : `.${part}`,
      )
      .split('.')
      .every((part) => requestFields.has(part))
  );
}

async function rejectionDiagnostic(
  response: Response,
  requestId: string,
  parentSignal: AbortSignal,
): Promise<SafeLogFields> {
  const diagnostic: SafeLogFields = {
    httpStatus: response.status,
    failureStage: 'provider_request',
    rejectedFields: [],
    rejectedKeywords: [],
  };
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId))
    diagnostic.requestId = requestId;
  const correlation = response.headers.get('x-request-id');
  if (correlation && correlation.length <= 256)
    diagnostic.providerRequestIdHash = createHash('sha256').update(correlation).digest('hex');
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, parentSignal]);
  const timer = setTimeout(() => {
    controller.abort();
  }, 500);
  try {
    const envelope = diagnosticObject(
      JSON.parse(await withAiAbort(signal, () => boundedText(response, 8_192, signal))) as unknown,
    );
    const outer = diagnosticObject(envelope.error);
    const raw = diagnosticObject(outer.metadata).raw;
    let inner = {};
    if (typeof raw === 'string') {
      try {
        inner = diagnosticObject(diagnosticObject(JSON.parse(raw) as unknown).error);
      } catch {
        /* Unrecognized provider text is discarded. */
      }
    }
    const fields = new Set<string>(),
      keywords = new Set<string>();
    for (const error of [outer, inner]) {
      const value = diagnosticObject(error);
      for (const code of [value.status, value.type, value.code])
        if (typeof code === 'string' && providerCodes.has(code)) diagnostic.providerCode = code;
      if (recognizedField(value.param)) fields.add(value.param);
      const details = Array.isArray(value.details) ? value.details : [];
      for (const detail of details) {
        const violations = diagnosticObject(detail).fieldViolations;
        if (Array.isArray(violations))
          for (const violation of violations) {
            const field = diagnosticObject(violation).field;
            if (recognizedField(field)) fields.add(field);
          }
      }
      if (typeof value.message === 'string') {
        if (value.message.trim() === 'Request contains an invalid argument.')
          diagnostic.providerReason = 'UNSPECIFIED_INVALID_ARGUMENT';
        for (const match of value.message.matchAll(
          /response schemas specified unsupported field ([A-Za-z_][A-Za-z_0-9]*)\b/g,
        ))
          if (requestFields.has(match[1] ?? '')) keywords.add(match[1] ?? '');
        for (const match of value.message.matchAll(/(?:^|\n)\s*(?:\*\s*)?([^:\r\n]{1,256}):/g))
          if (recognizedField(match[1])) fields.add(match[1]);
        for (const match of value.message.matchAll(/Invalid value at '([^']{1,256})'/g))
          if (recognizedField(match[1])) fields.add(match[1]);
        for (const match of value.message.matchAll(
          /Unknown name "([A-Za-z_][A-Za-z_0-9]*)"(?: at '([^']{1,256})')?/g,
        )) {
          if (requestFields.has(match[1] ?? '')) keywords.add(match[1] ?? '');
          if (recognizedField(match[2])) fields.add(match[2]);
        }
      }
    }
    diagnostic.rejectedFields = [...fields].slice(0, 16);
    diagnostic.rejectedKeywords = [...keywords].slice(0, 16);
  } catch {
    /* Diagnostic parsing must not alter provider failure or retry semantics. */
  } finally {
    clearTimeout(timer);
  }
  return diagnostic;
}

function decimal(value: string): boolean {
  return /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,12})?$/.test(value);
}

function accountingInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new AiGatewayError('AI_USAGE_ACCOUNTING_INCOMPLETE');
  return value;
}

function accountingNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new AiGatewayError('AI_USAGE_ACCOUNTING_INCOMPLETE');
  return value;
}
