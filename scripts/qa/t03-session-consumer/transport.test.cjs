const { test } = require("node:test");
const assert = require("node:assert/strict");
const { tarBytes, transferCommands, hostCommand } = require("./transport.cjs");
const { sha256 } = require("../t03-exact-sync/manifest.cjs");

test("deterministic regular-file archive preserves bytes and rejects unsafe archive paths", () => {
  const files = [
    {
      name: "compiled/sync/example.js",
      bytes: Buffer.from("public example\n"),
    },
    { name: "package-manifest.json", bytes: Buffer.from("{}\n") },
  ];
  const first = tarBytes(files),
    second = tarBytes([...files].reverse());
  assert.deepEqual(first, second);
  assert.equal(first.length % 512, 0);
  assert.equal(
    first.subarray(0, 100).toString().replaceAll("\0", ""),
    "compiled/sync/example.js",
  );
  assert.equal(first.subarray(156, 157).toString(), "0");
  assert.equal(
    first.subarray(512, 512 + files[0].bytes.length).toString(),
    files[0].bytes.toString(),
  );
  const oracle = require("node:child_process").spawnSync(
    "python",
    [
      "-B",
      "-c",
      'import sys,tarfile,io,json; t=tarfile.open(fileobj=io.BytesIO(sys.stdin.buffer.read()),mode="r:gz"); print(json.dumps([[m.name,m.isfile(),t.extractfile(m).read().decode()] for m in t.getmembers()]))',
    ],
    { input: require("node:zlib").gzipSync(first) },
  );
  assert.equal(oracle.status, 0, oracle.stderr.toString());
  assert.deepEqual(
    JSON.parse(oracle.stdout.toString()),
    files.map((file) => [file.name, true, file.bytes.toString()]),
  );
  assert.throws(
    () => tarBytes([{ name: "../escape", bytes: Buffer.from("x") }]),
    /QA_TRANSPORT_PATH/,
  );
});

test("private host actions require explicit review pins and every action hashes its broker before exec", () => {
  const pins = {
    packageSha256: "a".repeat(64),
    archiveSha256: "b".repeat(64),
    brokerSha256: "c".repeat(64),
  };
  assert.throws(
    () => hostCommand("session", pins),
    /QA_HOST_ACTION_REVIEW_REQUIRED/,
  );
  assert.throws(
    () => hostCommand("bind", pins),
    /QA_HOST_ACTION_REVIEW_REQUIRED/,
  );
  assert.throws(
    () =>
      hostCommand("approve-inspection", pins, {
        inspectionSha256: "e".repeat(64),
      }),
    /QA_HOST_ACTION_REVIEW_REQUIRED/,
  );
  assert.ok(
    hostCommand("approve-inspection", pins, {
      inspectionSha256: "e".repeat(64),
      inspectionCanonicalSha256: "f".repeat(64),
    }).includes("--inspection-canonical-sha256 " + "f".repeat(64)),
  );
  const command = hostCommand("session", pins, {
    manifestSha256: "d".repeat(64),
  });
  assert.ok(
    command.indexOf("hashlib.sha256") < command.indexOf("exec(compile"),
  );
  assert.ok(command.includes("--manifest-sha256 " + "d".repeat(64)));
  assert.ok(command.includes("--run-id t03-session-" + "b".repeat(16)));
  assert.ok(
    !command.includes("DATABASE_URL") && !command.includes("worker.env"),
  );
});

test("decoded-program verification still aborts under Python optimization before executing any program", () => {
  const program = Buffer.from('raise RuntimeError("SHOULD_NOT_EXECUTE")\n');
  const result = transferCommands(
    Buffer.from("public archive"),
    "a".repeat(64),
    program,
  );
  const command = result.commands[0];
  const source = command.slice(
    command.indexOf("-c '") + 4,
    command.indexOf("' init "),
  );
  const bad = source.replace(result.programSha256, "0".repeat(64));
  const child = require("node:child_process").spawnSync(
    "python",
    ["-B", "-O", "-c", bad],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 73, child.stderr);
  assert.ok(!child.stderr.includes("SHOULD_NOT_EXECUTE"));
});

test("fixed restored rehearsal is clockless and distinct from later pinned preflight and session commands", () => {
  const pins = {
    packageSha256: "a".repeat(64),
    archiveSha256: "b".repeat(64),
    brokerSha256: "c".repeat(64),
  };
  const rehearsal = hostCommand("preflight", pins, {
    restoredSuccessor: true,
    restoredRehearsal: true,
  });
  assert.ok(rehearsal.includes("--restored-successor --restored-rehearsal"));
  assert.ok(
    rehearsal.includes("--run-id t03-restored-rehearsal-" + "b".repeat(16)),
  );
  assert.ok(rehearsal.includes("--session-id t03-qa-" + "b".repeat(16)));
  assert.ok(
    !rehearsal.includes("--manifest-sha256") &&
      !rehearsal.includes("--duration"),
  );
  const preflight = hostCommand("preflight", pins, {
    restoredSuccessor: true,
    manifestSha256: "d".repeat(64),
  });
  assert.ok(
    preflight.includes("--run-id t03-preflight-") &&
      preflight.includes("--manifest-sha256 " + "d".repeat(64)),
  );
  const bind = hostCommand("bind", pins, { restoredSuccessor: true });
  assert.ok(
    bind.includes("--restored-successor") && bind.includes("--duration 3600"),
  );
  assert.ok(!bind.includes("--expectations-sha256"));
  for (const mode of [
    "bind",
    "session",
    "status",
    "stop",
    "inspect",
    "package-only",
  ]) {
    assert.throws(
      () =>
        hostCommand(mode, pins, {
          restoredSuccessor: true,
          restoredRehearsal: true,
        }),
      /QA_HOST_RESTORED_ACTION/,
    );
  }
  assert.throws(
    () =>
      hostCommand("preflight", pins, {
        restoredSuccessor: true,
        restoredRehearsal: true,
        manifestSha256: "d".repeat(64),
      }),
    /QA_HOST_RESTORED_ACTION/,
  );
});

test("ordered public chunk commands are bounded independently, hash decoded code before exec and never extract/start during upload", () => {
  const archive = Buffer.alloc(100000, 65),
    program = Buffer.from("PUBLIC_REVIEWED_PROGRAM\n");
  const result = transferCommands(archive, "a".repeat(64), program);
  assert.equal(result.partCount, 5);
  assert.equal(result.commands.length, 7);
  for (const command of [...result.commands, result.installCommand]) {
    assert.ok(Buffer.byteLength(command) < 65536);
    assert.ok(!command.includes("\n"));
    assert.ok(
      command.indexOf("hashlib.sha256") < command.indexOf("exec(compile"),
    );
  }
  assert.ok(result.commands[0].includes(" init "));
  assert.ok(result.commands.at(-1).includes(" finalize "));
  assert.ok(result.installCommand.includes(" install "));
  assert.ok(
    !result.commands.some(
      (command) =>
        command.includes(" install ") ||
        command.includes("docker") ||
        command.includes("worker.env"),
    ),
  );
  assert.equal(result.archiveSha256, sha256(archive));
});
