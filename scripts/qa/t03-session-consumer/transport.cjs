const fs = require("node:fs");
const path = require("node:path");
const { gzipSync } = require("node:zlib");
const {
  sha256,
  requireCondition: requireThat,
} = require("../t03-exact-sync/manifest.cjs");
const { fileList, assertNoLinks } = require("./artifact.cjs");

function tarBytes(files) {
  const chunks = [];
  const names = new Set();
  for (const file of [...files].sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    requireThat(
      /^[A-Za-z0-9@._/-]+$/.test(file.name) &&
        !file.name.startsWith("/") &&
        !file.name.split("/").some((part) => ["", ".", ".."].includes(part)) &&
        !names.has(file.name),
      "QA_TRANSPORT_PATH",
    );
    names.add(file.name);
    let name = file.name,
      prefix = "";
    if (Buffer.byteLength(name) > 100) {
      const index = name.lastIndexOf("/");
      prefix = name.slice(0, index);
      name = name.slice(index + 1);
    }
    requireThat(
      Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155,
      "QA_TRANSPORT_TAR_NAME",
    );
    const header = Buffer.alloc(512);
    const text = (value, start, length) =>
      header.write(value, start, length, "ascii");
    const octal = (number, start, length) =>
      text(number.toString(8).padStart(length - 1, "0") + "\0", start, length);
    text(name, 0, 100);
    octal(0o444, 100, 8);
    octal(0, 108, 8);
    octal(0, 116, 8);
    octal(file.bytes.length, 124, 12);
    octal(0, 136, 12);
    header.fill(32, 148, 156);
    text("0", 156, 1);
    text("ustar\0", 257, 6);
    text("00", 263, 2);
    text(prefix, 345, 155);
    const checksum = header.reduce((sum, value) => sum + value, 0);
    text(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
    chunks.push(
      header,
      file.bytes,
      Buffer.alloc((512 - (file.bytes.length % 512)) % 512),
    );
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

const quote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
function transferCommands(archive, packagePin, program) {
  requireThat(
    /^[a-f0-9]{64}$/.test(packagePin) &&
      program.length <= 65536 &&
      archive.length > 0 &&
      archive.length <= 10485760,
    "QA_TRANSPORT_INPUT",
  );
  const archiveSha256 = sha256(archive),
    programSha256 = sha256(program);
  const parts = [];
  for (let offset = 0; offset < archive.length; offset += 24576)
    parts.push(archive.subarray(offset, offset + 24576));
  const programPath = `/opt/masarifi/qa-t03/uploads/${archiveSha256}/program.py`;
  const loader = (first) =>
    first
      ? `import base64,hashlib,sys; b=base64.b64decode(${JSON.stringify(program.toString("base64"))},validate=True); (hashlib.sha256(b).hexdigest()==${JSON.stringify(programSha256)}) or sys.exit(73); exec(compile(b,"reviewed-t03-public-transport","exec"),{"__name__":"__main__","__reviewed_source__":b})`
      : `import os,hashlib,sys; f=os.open(${JSON.stringify(programPath)},os.O_RDONLY|os.O_NOFOLLOW); b=os.read(f,65537); os.close(f); (hashlib.sha256(b).hexdigest()==${JSON.stringify(programSha256)}) or sys.exit(73); exec(compile(b,"reviewed-t03-public-transport","exec"),{"__name__":"__main__","__reviewed_source__":b})`;
  const common = ` --archive-sha256 ${archiveSha256} --package-sha256 ${packagePin} --program-sha256 ${programSha256} --archive-bytes ${archive.length} --parts ${parts.length}`;
  const command = (stage, extra = "", first = false) =>
    `python3 -c ${quote(loader(first))} ${stage}${common}${extra}`;
  const commands = [
    command("init", "", true),
    ...parts.map((bytes, index) =>
      command(
        "chunk",
        ` --sequence ${index} --part-sha256 ${sha256(bytes)} --data ${bytes.toString("base64")}`,
      ),
    ),
    command("finalize"),
  ];
  const installCommand = command("install");
  for (const value of [...commands, installCommand])
    requireThat(
      !value.includes("\n") && Buffer.byteLength(value) <= 65536,
      "QA_TRANSPORT_COMMAND_LIMIT",
    );
  return {
    commands,
    installCommand,
    archiveSha256,
    programSha256,
    partCount: parts.length,
    partPins: parts.map((bytes, sequence) => ({
      sequence,
      bytes: bytes.length,
      sha256: sha256(bytes),
    })),
  };
}

function prepareTransfer(packageRoot, output) {
  assertNoLinks(packageRoot);
  const manifestBytes = fs.readFileSync(
    path.join(packageRoot, "package-manifest.json"),
  );
  const manifest = JSON.parse(manifestBytes);
  const actual = fileList(packageRoot).map((full) =>
    path.relative(packageRoot, full).replaceAll(path.sep, "/"),
  );
  const expected = [
    ...manifest.files.map((entry) => entry.path),
    "package-manifest.json",
  ].sort();
  requireThat(
    JSON.stringify(actual.sort()) === JSON.stringify(expected),
    "QA_TRANSPORT_FILE_SET",
  );
  const files = actual.map((name) => ({
    name,
    bytes: fs.readFileSync(path.join(packageRoot, name)),
  }));
  for (const entry of manifest.files) {
    const found = files.find((file) => file.name === entry.path);
    requireThat(
      found.bytes.length === entry.bytes &&
        sha256(found.bytes) === entry.sha256,
      "QA_TRANSPORT_FILE_PIN",
    );
  }
  const archive = gzipSync(tarBytes(files), { level: 9 });
  const program = fs.readFileSync(
    path.join(packageRoot, "scripts/qa/t03-session-consumer/host_transport.py"),
  );
  const transport = transferCommands(archive, sha256(manifestBytes), program);
  fs.mkdirSync(output);
  const save = (name, bytes) =>
    fs.writeFileSync(path.join(output, name), bytes, { flag: "wx" });
  save("artifact.tar.gz", archive);
  const commands = Buffer.from(
    JSON.stringify(transport.commands, null, 2) + "\n",
  );
  const install = Buffer.from(
    JSON.stringify([transport.installCommand], null, 2) + "\n",
  );
  save("public-upload.commands.txt", commands);
  save("public-install.commands.txt", install);
  const receipt = {
    archiveSha256: transport.archiveSha256,
    archiveBytes: archive.length,
    packageSha256: sha256(manifestBytes),
    packageFileCount: files.length,
    expandedFileBytes: files.reduce((n, file) => n + file.bytes.length, 0),
    programSha256: transport.programSha256,
    partCount: transport.partCount,
    uploadCommandCount: transport.commands.length,
    maxCommandBytes: Math.max(
      ...transport.commands.map((line) => Buffer.byteLength(line)),
      Buffer.byteLength(transport.installCommand),
    ),
    uploadTextBytes: commands.length,
    uploadTextSha256: sha256(commands),
    installTextBytes: install.length,
    installTextSha256: sha256(install),
    parts: transport.partPins,
    hostArchivePath: `/opt/masarifi/qa-t03/uploads/${transport.archiveSha256}/artifact.tar.gz`,
    hostPackagePath: `/opt/masarifi/qa-t03/packages/${transport.archiveSha256}`,
    containsPrivateBindings: false,
    uploadExtractsOrStarts: false,
  };
  save("transport-receipt.json", JSON.stringify(receipt, null, 2) + "\n");
  const actionPins = {
    packageSha256: receipt.packageSha256,
    archiveSha256: receipt.archiveSha256,
    brokerSha256: sha256(
      fs.readFileSync(
        path.join(
          packageRoot,
          "scripts/qa/t03-session-consumer/host_broker.py",
        ),
      ),
    ),
  };
  const publicActions = {
    packageOnly: hostCommand("package-only", actionPins),
    inspect: hostCommand("inspect", actionPins),
    laterPrivatePhasesEnabled: false,
    sessionId: `t03-qa-${receipt.archiveSha256.slice(0, 16)}`,
    requiredLaterPins: [
      "inspectionSha256",
      "inspectionCanonicalSha256",
      "expectationsSha256",
      "manifestSha256",
    ],
  };
  save(
    "public-host-actions.json",
    JSON.stringify({ ...actionPins, ...publicActions }, null, 2) + "\n",
  );
  return receipt;
}

function hostCommand(mode, pins, reviewed = {}) {
  const restored = reviewed.restoredSuccessor === true;
  const rehearsal = reviewed.restoredRehearsal === true;
  requireThat(
    (!restored ||
      ["bind", "preflight", "session", "status", "stop"].includes(mode)) &&
      (!rehearsal ||
        (restored &&
          mode === "preflight" &&
          reviewed.manifestSha256 === undefined)),
    "QA_HOST_RESTORED_ACTION",
  );
  requireThat(
    [
      "package-only",
      "inspect",
      "approve-inspection",
      "bind",
      "preflight",
      "session",
      "status",
      "stop",
    ].includes(mode),
    "QA_HOST_ACTION_MODE",
  );
  for (const key of ["packageSha256", "archiveSha256", "brokerSha256"])
    requireThat(/^[a-f0-9]{64}$/.test(pins[key] ?? ""), "QA_HOST_ACTION_PIN");
  const id = pins.archiveSha256.slice(0, 16),
    broker = `/opt/masarifi/qa-t03/packages/${pins.archiveSha256}/scripts/qa/t03-session-consumer/host_broker.py`;
  const loader = `import os,hashlib,sys; f=os.open(${JSON.stringify(broker)},os.O_RDONLY|os.O_NOFOLLOW); b=os.read(f,65537); os.close(f); (hashlib.sha256(b).hexdigest()==${JSON.stringify(pins.brokerSha256)}) or sys.exit(73); exec(compile(b,${JSON.stringify(broker)},"exec"),{"__name__":"__main__","__file__":${JSON.stringify(broker)}})`;
  let args = ` ${mode} --package-sha256 ${pins.packageSha256} --archive-sha256 ${pins.archiveSha256}`;
  if (restored) args += " --restored-successor";
  if (rehearsal) args += " --restored-rehearsal";
  const needs =
    rehearsal || (restored && mode === "bind")
      ? undefined
      : {
          "approve-inspection": ["inspectionSha256", "inspection-sha256"],
          bind: ["expectationsSha256", "expectations-sha256"],
          preflight: ["manifestSha256", "manifest-sha256"],
          session: ["manifestSha256", "manifest-sha256"],
          status: ["manifestSha256", "manifest-sha256"],
        }[mode];
  if (needs) {
    requireThat(
      /^[a-f0-9]{64}$/.test(reviewed[needs[0]] ?? ""),
      "QA_HOST_ACTION_REVIEW_REQUIRED",
    );
    args += ` --${needs[1]} ${reviewed[needs[0]]}`;
  }
  if (mode === "approve-inspection") {
    requireThat(
      /^[a-f0-9]{64}$/.test(reviewed.inspectionCanonicalSha256 ?? ""),
      "QA_HOST_ACTION_REVIEW_REQUIRED",
    );
    args += ` --inspection-canonical-sha256 ${reviewed.inspectionCanonicalSha256}`;
  }
  if (
    ["package-only", "inspect", "bind", "preflight", "session"].includes(mode)
  )
    args += ` --run-id t03-${rehearsal ? "restored-rehearsal" : mode}-${id}`;
  if (["inspect", "bind"].includes(mode))
    args += ` --session-id t03-qa-${id} --duration 3600`;
  if (rehearsal) args += ` --session-id t03-qa-${id}`;
  if (["status", "stop"].includes(mode)) args += ` --run-id t03-session-${id}`;
  const command = `python3 -B -c ${quote(loader)}${args}`;
  requireThat(
    Buffer.byteLength(command) <= 65536 && !command.includes("\n"),
    "QA_HOST_ACTION_SIZE",
  );
  return command;
}
module.exports = { tarBytes, transferCommands, prepareTransfer, hostCommand };
