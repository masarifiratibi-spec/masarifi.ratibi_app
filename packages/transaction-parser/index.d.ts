export type Direction = 'outgoing' | 'incoming' | 'internal' | 'unknown';
export type FinancialStatus = 'completed' | 'pending' | 'failed' | 'declined' | 'cancelled' | 'administrative' | 'unknown';
export type Disposition = 'capture_candidate' | 'review' | 'ignore';
export interface Rule {
  ruleKey: string; family: 'action' | 'status' | 'exclusion'; enabled: boolean; priority: number;
  any: string[]; all?: string[]; not?: string[]; countries?: string[]; locales?: string[]; providers?: string[]; channels?: string[];
  effects: {direction?: Direction; subtype?: string; status?: FinancialStatus; disposition?: Disposition};
}
export interface RuleSnapshot {
  schemaVersion: 2; engineVersion: string; releaseId: string; releaseNo: number; aiEnabled: false;
  currencies: {code: string; scale: number; supported: boolean; aliases: string[]}[]; rules: Rule[];
  providers?: {providerKey:string;country:string;senders:string[];packages:string[]}[];
  discoveryContexts?: string[];
}
export interface Classification {
  direction: Direction; subtype: string; status: FinancialStatus; disposition: Disposition;
  amountMinor: number | null; currency: string | null; merchant: string | null;
  instruments: {role: 'card' | 'account'; suffix: string; side?: 'source' | 'destination'}[];
  occurredAt: string | null; timeProvenance: 'embedded' | 'received' | 'ambiguous';
  providerReference: string | null; reasonCodes: string[]; appliedRuleKeys: string[];
  releaseId: string; engineVersion: string;
}
export function normalizeFinancialText(value: string): string;
export function validateRuleSnapshot(value: unknown): RuleSnapshot;
export function validateClassification(value: unknown): Omit<Classification, 'providerReference'>;
export function classifyFinancialMessage(input: {text: string; sender?: string; country?: string | null; locale?: string; channel?: string; receivedAt?: number}, snapshot?: RuleSnapshot): Classification;
export const defaultSnapshot: RuleSnapshot;
export const evidenceCorpus: {id:string; evidence:string; sender:string; country:string|null; text:string; expected:Record<string,string|number|null>}[];

export function canonicalJson(value: unknown): string;
export interface FinancialKeywordOverride {id?:string;value:string;enabled:boolean;origin?:string}
export interface FinancialDiscoveryPolicy {
  version:1;releaseId:string;engineVersion:string;rules:Rule[];
  currencies:RuleSnapshot['currencies'];contexts:string[];custom:{ruleKey:string;phrase:string}[];providers:NonNullable<RuleSnapshot['providers']>;marketingPattern:string;
}
export function effectiveFinancialSnapshot(snapshot:RuleSnapshot,overrides?:readonly FinancialKeywordOverride[]):RuleSnapshot;
export function compileFinancialDiscoveryPolicy(snapshot:RuleSnapshot,overrides?:readonly FinancialKeywordOverride[]):FinancialDiscoveryPolicy;
export function discoverFinancialMessage(input:Parameters<typeof classifyFinancialMessage>[0],snapshot?:RuleSnapshot,overrides?:readonly FinancialKeywordOverride[]):{strong:boolean;classification:Classification;customRuleKeys:string[]};
