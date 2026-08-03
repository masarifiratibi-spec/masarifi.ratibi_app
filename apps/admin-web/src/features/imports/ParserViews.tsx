"use client";

import type { Phase4Resource } from "./contracts";
import { OperationalDetailView, OperationalListView } from "./ImportsViews";

type ParserListResource = Exclude<
  Phase4Resource,
  "sessions" | "failures" | "low-confidence" | "duplicates" | "unsupported"
>;

export function ParserListView({ resource }: { resource: ParserListResource }) {
  return <OperationalListView resource={resource} />;
}

export function BankDetailView({ bankId }: { bankId: string }) {
  return <OperationalDetailView id={bankId} resource="banks" />;
}

export function ParserRuleDetailView({ ruleId }: { ruleId: string }) {
  return <OperationalDetailView id={ruleId} resource="parser-rules" />;
}
