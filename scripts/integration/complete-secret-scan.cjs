"use strict";
const { execFileSync, spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync, rmSync } = require("node:fs");
const { createHash } = require("node:crypto");
const reviewed = require("./reviewed-secret-findings.json");

const digest = (algorithm, value) =>
  createHash(algorithm).update(value).digest("hex");

function classifyScanReport(
  reportText,
  scannerStatus,
  { cwd = process.cwd() } = {},
) {
  if (![0, 2].includes(scannerStatus))
    throw new Error("Unexpected scanner status; candidate scan failed");
  let findings;
  try {
    findings = JSON.parse(reportText);
  } catch {
    throw new Error("Missing or malformed redacted findings report");
  }
  if (
    !Array.isArray(findings) ||
    (scannerStatus === 0 && findings.length !== 0) ||
    (scannerStatus === 2 && findings.length === 0)
  )
    throw new Error("Findings report is inconsistent with scanner status");
  for (const f of findings) {
    if (
      !f ||
      typeof f !== "object" ||
      typeof f.RuleID !== "string" ||
      !/^[a-z0-9-]+$/.test(f.RuleID) ||
      typeof f.Commit !== "string" ||
      !/^[a-f0-9]{40}$/.test(f.Commit) ||
      typeof f.File !== "string" ||
      !f.File ||
      /[\r\n\0]/.test(f.File) ||
      ![f.StartLine, f.EndLine, f.StartColumn, f.EndColumn].every(
        (n) => Number.isSafeInteger(n) && n > 0,
      ) ||
      f.EndLine < f.StartLine ||
      (f.EndLine === f.StartLine && f.EndColumn < f.StartColumn) ||
      f.Secret !== "REDACTED" ||
      typeof f.Match !== "string" ||
      !f.Match.includes("REDACTED") ||
      f.Fingerprint !== `${f.Commit}:${f.File}:${f.RuleID}:${f.StartLine}`
    )
      throw new Error("Invalid or unredacted findings report entry");
  }
  if (reviewed.version !== 1 || !Array.isArray(reviewed.findings))
    throw new Error("Invalid reviewed findings catalog");
  const catalog = new Map(
    reviewed.findings.map((entry) => [entry.fingerprint, entry]),
  );
  if (catalog.size !== reviewed.findings.length)
    throw new Error("Duplicate reviewed findings catalog entry");
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  const verified = new Map();
  function originalValue(entry) {
    if (verified.has(entry.fingerprint)) return verified.get(entry.fingerprint);
    const [commit, file] = entry.fingerprint.split(":");
    let blob, source;
    try {
      blob = git("rev-parse", `${commit}:${file}`).trim();
      if (blob !== entry.blob) throw new Error("blob mismatch");
      source = git("cat-file", "blob", blob);
    } catch {
      throw new Error(
        "Reviewed finding original Git blob could not be verified",
      );
    }
    const line = source.split(/\r?\n/)[entry.line - 1];
    let value, contextVerified;
    if (entry.classification === "synthetic-unit-lease") {
      // The full reviewed blob binds this declaration to its fake-only uses.
      // Never execute historical JavaScript to inspect a finding.
      const declaration =
        /^  const claimToken = '([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})';$/.exec(
          line ?? "",
        );
      value = declaration?.[1];
      contextVerified =
        entry.binding === "claimToken" &&
        digest("sha512", source) === entry.sourceDigest;
    } else if (entry.classification === "host-inventory-field") {
      // The scanner matched the fourth field name in a literal inventory loop.
      // Parse only its four data literals, without executing historical Python.
      const fields = /^    for name in \((.*)\):$/.exec(line ?? "");
      const tuple = fields && JSON.parse("[" + fields[1] + "]");
      value = tuple?.[3];
      contextVerified =
        Array.isArray(tuple) &&
        tuple.length === 4 &&
        tuple.slice(0, 3).join("/") === "actualApi/admin/protectedPrimaryApi" &&
        value === "protectedLegacyApi3000";
    } else {
      try {
        value = JSON.parse(source);
        for (const part of entry.pointer) value = value[part];
      } catch {
        throw new Error("Reviewed finding JSON context could not be verified");
      }
      contextVerified =
        typeof line === "string" &&
        line.includes(
          `${JSON.stringify(entry.pointer.at(-1))}: ${JSON.stringify(value)}`,
        );
      if (entry.classification === "packet-executor-digest") {
        const name = "api_archive.py";
        const sibling = file.slice(0, file.lastIndexOf("/") + 1) + name;
        contextVerified =
          contextVerified &&
          entry.pointer.join("/") === "executorSha256/" + name &&
          value === digest("sha256", git("show", commit + ":" + sibling));
      }
    }
    if (
      typeof line !== "string" ||
      digest("sha512", line) !== entry.lineDigest ||
      typeof value !== "string" ||
      digest("sha512", value) !== entry.valueDigest ||
      !contextVerified
    )
      throw new Error(
        "Reviewed finding original value or line context changed",
      );
    verified.set(entry.fingerprint, value);
    return value;
  }
  function publicValue() {
    const entry = catalog.get(reviewed.publicReference);
    if (!entry || entry.classification !== "clerk-publishable")
      throw new Error("Missing reviewed Clerk public reference");
    const value = originalValue(entry);
    if (
      !/^pk_live_[A-Za-z0-9+/=]+$/.test(value) ||
      !/^[a-z0-9.-]+\$$/.test(
        Buffer.from(value.slice(8), "base64").toString("utf8"),
      )
    )
      throw new Error("Reviewed reference is not a Clerk publishable key");
    return value;
  }
  const classified = findings.map((f) => {
    const entry = catalog.get(f.Fingerprint);
    let classification = "unreviewed";
    if (
      entry &&
      f.RuleID === "generic-api-key" &&
      f.StartLine === entry.line &&
      f.EndLine === entry.line &&
      f.StartColumn === entry.startColumn &&
      f.EndColumn === entry.endColumn &&
      f.Match ===
        (entry.classification === "synthetic-unit-lease"
          ? `${entry.binding} = 'REDACTED'`
          : entry.classification === "host-inventory-field"
            ? 'protectedPrimaryApi","REDACTED"'
            : `${entry.pointer.at(-1)}\": \"REDACTED\"`)
    ) {
      const value = originalValue(entry);
      if (
        entry.classification === "clerk-publishable" &&
        value === publicValue()
      )
        classification = entry.classification;
      else if (
        entry.classification === "public-clerk-sha256" &&
        value === digest("sha256", publicValue()) &&
        entry.pointer.at(-2) === "publicConfigurationSha256" &&
        entry.pointer.at(-1) === "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
      )
        classification = entry.classification;
      else if (
        [
          "synthetic-unit-lease",
          "host-inventory-field",
          "packet-executor-digest",
        ].includes(entry.classification)
      )
        classification = entry.classification;
      else if (
        entry.classification === "release-env-sha256" &&
        entry.pointer.length === 1 &&
        entry.pointer[0] === "unchangedApiEnvSha256" &&
        /^[a-f0-9]{64}$/.test(value)
      )
        classification = entry.classification;
    }
    return { fingerprint: f.Fingerprint, classification };
  });
  return {
    exitCode: classified.some((f) => f.classification === "unreviewed") ? 2 : 0,
    scannerStatus,
    findings: classified,
  };
}

function scanCandidate({
  eventName,
  event,
  candidateSha,
  reportPath,
  cwd = process.cwd(),
  binary = "gitleaks",
}) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  if (git("rev-parse", "--is-shallow-repository") !== "false") {
    throw new Error("Complete secret scan requires non-shallow history");
  }
  function commit(sha) {
    if (
      typeof sha !== "string" ||
      !/^[a-f0-9]{40}$/i.test(sha) ||
      /^0+$/.test(sha)
    ) {
      throw new Error("Missing or invalid commit SHA");
    }
    try {
      git("cat-file", "-e", `${sha}^{commit}`);
    } catch {
      throw new Error("Required commit object is unavailable");
    }
    return sha;
  }
  let range;
  if (eventName === "pull_request") {
    range = `${commit(event.pull_request?.base?.sha)}..${commit(event.pull_request?.head?.sha)}`;
  } else if (eventName === "push") {
    const head = commit(event.after);
    range =
      event.before === "0".repeat(40)
        ? head
        : `${commit(event.before)}..${head}`;
  } else if (eventName === "workflow_dispatch") {
    range = commit(candidateSha);
  } else {
    throw new Error("Unsupported event for complete secret scan");
  }
  if (!reportPath)
    throw new Error("A redacted findings report path is required");
  const count = git("rev-list", "--count", range);
  const version = spawnSync(binary, ["version"], {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  if (
    version.error ||
    version.status !== 0 ||
    version.stdout.trim() !== "8.24.3"
  ) {
    throw new Error("Gitleaks 8.24.3 is required");
  }
  console.log(`Complete candidate secret scan: ${range} (${count} commits)`);
  // An old successful report must never satisfy a failed/current scan.
  for (const path of [reportPath, `${reportPath}.classification.json`])
    rmSync(path, { force: true });
  // -m also scans changes introduced by merges; traversal includes every parent.
  const scan = spawnSync(
    binary,
    [
      "git",
      "--redact",
      "--no-banner",
      "--no-color",
      "--exit-code=2",
      "--report-format=json",
      "--report-path",
      reportPath,
      "--log-opts",
      `--full-history -m ${range}`,
    ],
    { cwd, stdio: "inherit", shell: false },
  );
  if (scan.error || scan.signal || scan.status === null) {
    throw new Error("Gitleaks could not complete the candidate scan");
  }
  if (![0, 2].includes(scan.status)) return scan.status;
  let report;
  try {
    report = readFileSync(reportPath, "utf8");
  } catch {
    throw new Error("Missing redacted candidate findings report");
  }
  const classification = classifyScanReport(report, scan.status, { cwd });
  writeFileSync(
    `${reportPath}.classification.json`,
    JSON.stringify(
      {
        range,
        commitCount: Number(count),
        ...classification,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Reviewed noncredential findings: ${classification.findings.filter((f) => f.classification !== "unreviewed").length}; unreviewed: ${classification.findings.filter((f) => f.classification === "unreviewed").length}`,
  );
  return classification.exitCode;
}

if (require.main === module) {
  try {
    const event = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    process.exitCode = scanCandidate({
      eventName: process.env.GITHUB_EVENT_NAME,
      event,
      candidateSha: process.env.GITHUB_SHA,
      reportPath: process.argv[2],
    });
  } catch (error) {
    console.error(`Complete candidate secret scan failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { scanCandidate, classifyScanReport };
