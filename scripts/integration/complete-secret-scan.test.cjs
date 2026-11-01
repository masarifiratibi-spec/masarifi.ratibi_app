"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { randomBytes } = require("node:crypto");
const { scanCandidate } = require("./complete-secret-scan.cjs");
const binary = process.env.GITLEAKS_BINARY || "gitleaks";

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "complete-secret-scan-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--initial-branch=main");
  git("config", "user.name", "Secret scan fixture");
  git("config", "user.email", "fixture@example.invalid");
  const commit = (name, contents = name) => {
    writeFileSync(join(cwd, "candidate.txt"), contents + "\n");
    git("add", ".");
    git("commit", "-m", name);
    return git("rev-parse", "HEAD");
  };
  const base = commit("base");
  const reportPath = join(cwd, "findings.json");
  const scan = (eventName, event, candidateSha, overrides = {}) =>
    scanCandidate({
      cwd,
      binary,
      reportPath,
      eventName,
      event,
      candidateSha,
      ...overrides,
    });
  const findings = () => JSON.parse(readFileSync(reportPath, "utf8"));
  return { cwd, git, commit, base, reportPath, scan, findings };
}

function syntheticSecret() {
  return `service_token=${["ghp", randomBytes(27).toString("hex").slice(0, 36)].join("_")}`;
}

// PR 9's action scanned only its first page of commits, omitting the real head.
test("actual PR head finds a removed secret beyond commit 30 despite another checkout", (t) => {
  const f = fixture(t);
  for (let i = 1; i <= 34; i++) f.commit(`safe-${i}`);
  const leaked = f.commit("late synthetic secret", syntheticSecret());
  const head = f.commit("remove synthetic secret");
  f.git("checkout", "--detach", f.base);
  assert.equal(
    f.scan(
      "pull_request",
      { pull_request: { base: { sha: f.base }, head: { sha: head } } },
      f.base,
    ),
    2,
  );
  const finding = f
    .findings()
    .find((finding) => finding.RuleID === "github-pat");
  assert.equal(finding.Commit, leaked);
  assert.equal(finding.Secret, "REDACTED");
  assert.ok(!readFileSync(f.reportPath, "utf8").includes("ghp_"));
});

test("merge-only secrets and side-branch history are scanned", (t) => {
  const f = fixture(t);
  f.git("checkout", "-b", "side");
  const sideLeak = f.commit("side secret", syntheticSecret());
  f.commit("remove side secret");
  f.git("checkout", "main");
  writeFileSync(join(f.cwd, "main.txt"), "safe\n");
  f.git("add", ".");
  f.git("commit", "-m", "main change");
  f.git("merge", "--no-ff", "--no-commit", "side");
  writeFileSync(join(f.cwd, "merge-only.txt"), syntheticSecret() + "\n");
  f.git("add", ".");
  f.git("commit", "-m", "merge-only secret");
  const head = f.git("rev-parse", "HEAD");
  assert.equal(
    f.scan("pull_request", {
      pull_request: { base: { sha: f.base }, head: { sha: head } },
    }),
    2,
  );
  const commits = new Set(f.findings().map((finding) => finding.Commit));
  assert.ok(commits.has(sideLeak));
  assert.ok(commits.has(head));
});

test("push range excludes old history while new branches and manual runs include it", (t) => {
  const f = fixture(t);
  const leaked = f.commit("historical synthetic secret", syntheticSecret());
  const before = f.commit("remove historical secret");
  const after = f.commit("safe candidate");
  assert.equal(f.scan("push", { before, after }, f.base), 0);
  assert.deepEqual(f.findings(), []);
  for (const [eventName, event, sha] of [
    ["push", { before: "0".repeat(40), after }, f.base],
    ["workflow_dispatch", {}, after],
  ]) {
    assert.equal(f.scan(eventName, event, sha), 2);
    assert.ok(f.findings().some((finding) => finding.Commit === leaked));
  }
});

test("invalid or unavailable commits, unsupported events and shallow history fail closed", (t) => {
  const f = fixture(t);
  for (const after of [
    "--all",
    "HEAD",
    "a".repeat(40),
    "0".repeat(40),
    undefined,
  ]) {
    assert.throws(
      () => f.scan("push", { before: f.base, after }),
      /commit SHA|commit object/,
    );
  }
  assert.throws(() => f.scan("pull_request", {}), /commit SHA/);
  assert.throws(() => f.scan("schedule", {}, f.base), /Unsupported event/);
  const shallow = join(f.cwd, "shallow");
  f.git("clone", "--depth=1", `file://${f.cwd.replace(/\\/g, "/")}`, shallow);
  assert.throws(
    () => f.scan("workflow_dispatch", {}, f.base, { cwd: shallow }),
    /shallow/,
  );
});

test("scanner failures and a missing binary cannot pass", (t) => {
  const f = fixture(t);
  assert.notEqual(
    f.scan("workflow_dispatch", {}, f.base, { reportPath: f.cwd }),
    0,
  );
  assert.throws(
    () =>
      f.scan("workflow_dispatch", {}, f.base, {
        binary: join(f.cwd, "missing-gitleaks"),
      }),
    /Gitleaks/,
  );
});
