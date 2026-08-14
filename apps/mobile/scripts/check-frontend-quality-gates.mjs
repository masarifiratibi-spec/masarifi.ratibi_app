#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const statuses = new Set(['pass', 'fail', 'blocked']);

export function checkValidationLedger(filePath, { now = Date.now() } = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const cases = parseRows(source, '## Validation Cases').map((row) => ({
    id: row['Case ID'],
    status: row.Status,
    exception: row.Exception
  }));
  const baselineCases = parseRows(source, '## Baseline Runs').map((row) => ({
    id: row['Case ID'],
    status: row.Status,
    exception: ''
  }));
  const allCases = [...cases, ...baselineCases].filter((row) => row.id);
  const gates = parseRows(source, '## Delivery Gates').map((row) => ({
    id: row['Gate ID'],
    requiredCases: splitList(row['Required cases']),
    status: row.Status,
    exceptionId: row['Exception ID']
  }));

  const duplicate = firstDuplicate(allCases.map((row) => row.id));
  if (duplicate) throw new Error(`duplicate case id: ${duplicate}`);
  const caseMap = new Map(allCases.map((row) => [row.id, row]));
  const failures = [];

  for (const gate of gates) {
    if (!statuses.has(gate.status)) failures.push(`${gate.id}: invalid status`);
    const missing = gate.requiredCases.filter((id) => id !== 'TBD' && !caseMap.has(id));
    if (missing.length) failures.push(`${gate.id}: missing cases ${missing.join(', ')}`);
    const required = gate.requiredCases.map((id) => caseMap.get(id)).filter(Boolean);
    const derived = required.some((item) => item.status === 'fail')
      ? 'fail'
      : required.length === 0 || required.some((item) => item.status === 'blocked')
        ? 'blocked'
        : 'pass';
    if (derived === 'fail') failures.push(`${gate.id}: failed required case`);
    if (derived === 'blocked' && !currentException(gate.exceptionId, now)) {
      failures.push(`${gate.id}: blocked without current exception`);
    }
  }

  return { ok: failures.length === 0, failures, caseCount: allCases.length, gateCount: gates.length };
}

function parseRows(source, heading) {
  const start = source.indexOf(heading);
  if (start === -1) return [];
  const rest = source.slice(start + heading.length);
  const end = rest.search(/\n## /);
  const section = end === -1 ? rest : rest.slice(0, end);
  const lines = section.split(/\r?\n/).filter((line) => line.startsWith('|'));
  if (lines.length < 2) return [];
  const headers = splitRow(lines[0]);
  return lines.slice(2).map((line) => {
    const cells = splitRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function splitRow(line) {
  return line.slice(1, -1).split('|').map((cell) => cell.trim());
}

function splitList(value) {
  return value.replaceAll('<br>', ',').split(',').map((item) => item.trim()).filter(Boolean);
}

function firstDuplicate(values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function currentException(value, now) {
  if (!value) return false;
  const match = value.match(/expires=(\d+)/);
  return !match || Number(match[1]) > now;
}

async function main() {
  const file = path.resolve(process.argv[2] ?? 'specs/010-frontend-quality/validation.md');
  const result = checkValidationLedger(file);
  if (!result.ok) {
    console.error(result.failures.join('\n'));
    process.exit(1);
  }
  console.log(`Frontend-quality gates passed (${result.caseCount} cases, ${result.gateCount} gates).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
