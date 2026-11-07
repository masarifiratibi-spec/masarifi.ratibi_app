"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { randomBytes } = require("node:crypto");
const {
  scanCandidate,
  classifyScanReport,
} = require("./complete-secret-scan.cjs");
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
  assert.throws(() =>
    f.scan("workflow_dispatch", {}, f.base, { reportPath: f.cwd }),
  );
  assert.throws(
    () =>
      f.scan("workflow_dispatch", {}, f.base, {
        binary: join(f.cwd, "missing-gitleaks"),
      }),
    /Gitleaks/,
  );
});

// The expected coordinates and classifications below were reviewed from the
// failed CI artifact. No matched values are kept in these fixtures.
const reviewedExamples = [
  [
    "21f6836ea5f93479c10870e53f11f6bd593ddd21",
    "apps/mobile/eas.json",
    73,
    11,
    100,
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "clerk-publishable",
  ],
  [
    "513ebac39475c030d1dccf6517c99279ffa9c5dd",
    "apps/mobile/eas.json",
    73,
    11,
    100,
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "clerk-publishable",
  ],
  [
    "0389dff3936211b968c1128471cc313af3b2aef2",
    "apps/mobile/eas.json",
    73,
    11,
    100,
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "clerk-publishable",
  ],
  [
    "ec90dc7f9ca1d3e145ea57883f3e1c1b91da2a13",
    "ops/releases/2026-11-07-dashboard-reflow-activation/linux-ci-manifest.json",
    16,
    7,
    108,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "public-clerk-sha256",
  ],
  [
    "ec90dc7f9ca1d3e145ea57883f3e1c1b91da2a13",
    "ops/releases/2026-11-07-dashboard-reflow-activation/manifest.json",
    135,
    9,
    110,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "public-clerk-sha256",
  ],
  [
    "2c1fe4cdd02a4f3255791cac0f9ff9b2d9b363be",
    "ops/releases/2026-11-07-dashboard-ui/linux-ci-manifest.json",
    16,
    7,
    108,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "public-clerk-sha256",
  ],
  [
    "acd3baa84e2a5e577f90746b9314df1dd7b1f208",
    "ops/releases/2026-11-07-dashboard-brand-activation/linux-ci-manifest.json",
    16,
    7,
    108,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "public-clerk-sha256",
  ],
  [
    "acd3baa84e2a5e577f90746b9314df1dd7b1f208",
    "ops/releases/2026-11-07-dashboard-brand-activation/manifest.json",
    155,
    9,
    110,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "public-clerk-sha256",
  ],
  [
    "2c1fe4cdd02a4f3255791cac0f9ff9b2d9b363be",
    "ops/releases/2026-11-07-dashboard-ui/manifest.json",
    168,
    9,
    110,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "public-clerk-sha256",
  ],
  [
    "2c1fe4cdd02a4f3255791cac0f9ff9b2d9b363be",
    "ops/releases/2026-11-07-dashboard-ui/host-baseline.json",
    118,
    11,
    112,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "public-clerk-sha256",
  ],
  [
    "152be06588229715dd1fb6669a2d01e0c48f8fdb",
    "ops/releases/2026-11-05-voice-review-recovery/manifest.json",
    14,
    5,
    94,
    "unchangedApiEnvSha256",
    "release-env-sha256",
  ],
];

function reviewedReport() {
  return reviewedExamples.map(
    ([Commit, File, StartLine, StartColumn, EndColumn, field]) => ({
      RuleID: "generic-api-key",
      Commit,
      File,
      StartLine,
      EndLine: StartLine,
      StartColumn,
      EndColumn,
      Secret: "REDACTED",
      Match: `${field}\": \"REDACTED\"`,
      Fingerprint: `${Commit}:${File}:generic-api-key:${StartLine}`,
    }),
  );
}

test("only the eleven independently reviewed immutable findings pass classification", () => {
  const result = classifyScanReport(JSON.stringify(reviewedReport()), 2);
  assert.equal(result.exitCode, 0);
  assert.equal(result.findings.length, 11);
  assert.deepEqual(
    result.findings.map((f) => f.classification),
    reviewedExamples.map((f) => f[6]),
  );
});

test("changed fingerprints, locations, redacted match context, and rules remain blocked", () => {
  const original = reviewedReport()[0];
  for (const changed of [
    {
      Commit: "a".repeat(40),
      Fingerprint: original.Fingerprint.replace(
        original.Commit,
        "a".repeat(40),
      ),
    },
    {
      File: "copy.json",
      Fingerprint: original.Fingerprint.replace(original.File, "copy.json"),
    },
    {
      StartLine: 74,
      EndLine: 74,
      Fingerprint: original.Fingerprint.replace(/:73$/, ":74"),
    },
    { StartColumn: 12 },
    { EndColumn: 101 },
    { Match: 'AUTH_SECRET": "REDACTED"' },
    {
      RuleID: "stripe-access-token",
      Fingerprint: original.Fingerprint.replace(
        "generic-api-key",
        "stripe-access-token",
      ),
    },
  ]) {
    const result = classifyScanReport(
      JSON.stringify([{ ...original, ...changed }]),
      2,
    );
    assert.equal(result.exitCode, 2);
    assert.equal(result.findings[0].classification, "unreviewed");
  }
});

test("one unknown finding blocks a report containing reviewed public findings", () => {
  const findings = reviewedReport();
  findings.push({
    ...findings[0],
    RuleID: "github-pat",
    Fingerprint: findings[0].Fingerprint.replace(
      "generic-api-key",
      "github-pat",
    ),
  });
  const result = classifyScanReport(JSON.stringify(findings), 2);
  assert.equal(result.exitCode, 2);
  assert.equal(
    result.findings.filter((f) => f.classification === "unreviewed").length,
    1,
  );
});

test("catalog blob, exact value and JSON context are verified against original Git objects", (t) => {
  const catalog = require("./reviewed-secret-findings.json");
  const entry = catalog.findings.find(
    (f) => f.fingerprint === reviewedReport()[0].Fingerprint,
  );
  const original = { ...entry, pointer: [...entry.pointer] };
  t.after(() => Object.assign(entry, original));
  for (const changed of [
    { blob: "a".repeat(40) },
    { lineDigest: "a".repeat(128) },
    { valueDigest: "a".repeat(128) },
    {
      pointer: ["build", "missing", "env", "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"],
    },
  ]) {
    Object.assign(entry, original, changed);
    assert.throws(
      () => classifyScanReport(JSON.stringify([reviewedReport()[0]]), 2),
      /original|context/i,
    );
  }
  Object.assign(entry, original);
  const f = fixture(t);
  assert.throws(
    () =>
      classifyScanReport(JSON.stringify([reviewedReport()[0]]), 2, {
        cwd: f.cwd,
      }),
    /original Git blob/,
  );
});

test("missing, malformed, unredacted and status-inconsistent reports fail closed", () => {
  const original = reviewedReport()[0];
  for (const [report, status] of [
    [undefined, 0],
    ["", 0],
    ["{}", 0],
    ["[", 2],
    ["[null]", 2],
    ["[]", 2],
    [JSON.stringify([original]), 0],
    ["[]", 1],
    ["[]", 127],
    [JSON.stringify([{ ...original, Secret: "unredacted" }]), 2],
    [JSON.stringify([{ ...original, Fingerprint: "mismatched" }]), 2],
    [JSON.stringify([{ ...original, EndLine: 0 }]), 2],
  ])
    assert.throws(() => classifyScanReport(report, status), /report|scanner/i);
  assert.equal(classifyScanReport("[]", 0).exitCode, 0);
});

test("per-parent merge duplicates retain every finding and do not conceal changed context", () => {
  const finding = reviewedReport()[0];
  const repeated = classifyScanReport(JSON.stringify([finding, finding]), 2);
  assert.equal(repeated.exitCode, 0);
  assert.equal(repeated.findings.length, 2);
  const changed = classifyScanReport(
    JSON.stringify([
      finding,
      { ...finding, Match: 'AUTH_SECRET": "REDACTED"' },
    ]),
    2,
  );
  assert.equal(changed.exitCode, 2);
  assert.equal(changed.findings[1].classification, "unreviewed");
});

test("new public copies and auth secrets in a reviewed path never inherit its exception", (t) => {
  const f = fixture(t);
  const historical = JSON.parse(
    execFileSync(
      "git",
      ["show", "21f6836ea5f93479c10870e53f11f6bd593ddd21:apps/mobile/eas.json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  const publicValue =
    historical.build["ios-ad-hoc"].env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  mkdirSync(join(f.cwd, "apps/mobile"), { recursive: true });
  writeFileSync(
    join(f.cwd, "apps/mobile/eas.json"),
    "\n".repeat(71) +
      JSON.stringify(
        { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: publicValue },
        null,
        2,
      ),
  );
  const copied = f.commit("unreviewed public copy");
  writeFileSync(
    join(f.cwd, "apps/mobile/eas.json"),
    "\n".repeat(71) +
      JSON.stringify(
        {
          EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: syntheticSecret().split("=")[1],
          AUTH_SECRET: ["sk", "live", randomBytes(24).toString("hex")].join(
            "_",
          ),
        },
        null,
        2,
      ),
  );
  const head = f.commit("synthetic auth secrets at reviewed path");
  assert.equal(f.scan("workflow_dispatch", {}, head), 2);
  const report = f.findings();
  assert.ok(report.some((finding) => finding.RuleID === "github-pat"));
  assert.ok(
    report.some(
      (finding) => finding.Commit === copied && finding.StartLine === 73,
    ),
  );
  assert.ok(
    report.some(
      (finding) => finding.Commit === head && finding.StartLine === 74,
    ),
  );
  const result = classifyScanReport(JSON.stringify(report), 2, { cwd: f.cwd });
  assert.ok(
    result.findings.every((finding) => finding.classification === "unreviewed"),
  );
  const sidecar = JSON.parse(
    readFileSync(`${f.reportPath}.classification.json`, "utf8"),
  );
  assert.equal(sidecar.exitCode, 2);
  assert.deepEqual(sidecar.findings, result.findings);
});
