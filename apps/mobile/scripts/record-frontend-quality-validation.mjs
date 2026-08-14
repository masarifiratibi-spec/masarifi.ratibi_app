#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const statuses = new Set(['pass', 'fail', 'blocked']);
const kinds = new Set(['automated', 'visual', 'native', 'participant', 'inspection', 'performance']);
const forbiddenKeys = /amount|balance|account|transaction|message|transcript|question|answer|support|credential|rawError|secret/i;

export function validateValidationCase(input, now = Date.now()) {
  const allowed = new Set([
    'id',
    'requirements',
    'kind',
    'environment',
    'procedure',
    'expected',
    'actual',
    'status',
    'evidencePaths',
    'executedAt',
    'blockedBy',
    'exception'
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key) || forbiddenKeys.test(key)) throw new Error(`invalid field: ${key}`);
  }
  for (const key of ['id', 'environment', 'procedure', 'expected', 'actual', 'status']) {
    if (typeof input[key] !== 'string' || input[key].trim() === '') throw new Error(`missing ${key}`);
  }
  if (!Array.isArray(input.requirements) || input.requirements.length === 0) throw new Error('missing requirements');
  if (!input.requirements.every((item) => /^(FR|SC)-\d{3}$/.test(item))) throw new Error('invalid requirements');
  if (!kinds.has(input.kind)) throw new Error('invalid kind');
  if (!statuses.has(input.status)) throw new Error('invalid status');
  if (!Array.isArray(input.evidencePaths)) throw new Error('missing evidencePaths');
  const evidencePaths = input.evidencePaths.map(normalizeEvidencePath);
  if (input.status === 'blocked' && (typeof input.blockedBy !== 'string' || input.blockedBy.trim() === '')) {
    throw new Error('blocked case needs prerequisite');
  }
  if (input.status !== 'blocked' && !Number.isInteger(input.executedAt)) throw new Error('executed case needs date');
  if (input.exception) {
    if (input.status !== 'blocked') throw new Error('exception only allowed for blocked case');
    if (!Number.isInteger(input.exception.expiresAt) || input.exception.expiresAt <= now) throw new Error('expired exception');
  }
  return { ...input, evidencePaths };
}

export function toMarkdownRow(input) {
  const item = validateValidationCase(input);
  return `| ${item.id} | ${item.requirements.join(', ')} | ${item.kind} | ${formatDate(item.executedAt)} | ${cell(item.environment)} | ${cell(item.procedure)} | ${cell(item.expected)} | ${cell(item.actual)} | ${item.status} | ${item.evidencePaths.join('<br>')} |  |  | ${item.exception?.id ?? ''} |`;
}

function normalizeEvidencePath(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('invalid evidence path');
  const normalized = value.replaceAll('\\', '/');
  if (/^[A-Za-z]:\//.test(normalized) || normalized.includes('..')) throw new Error('evidence path must be workspace-relative');
  return normalized;
}

function formatDate(value) {
  return Number.isInteger(value) ? new Date(value).toISOString().slice(0, 10) : '';
}

function cell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node scripts/record-frontend-quality-validation.mjs case.json');
  const input = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  console.log(toMarkdownRow(input));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
