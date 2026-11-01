"use strict";
const { execFileSync, spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

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
  return scan.status;
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

module.exports = { scanCandidate };
