const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { sha256 } = require("../t03-exact-sync/manifest.cjs");

function filesystemBoundary({
  failMarker = false,
  existing = false,
  failAdmissionSync = false,
} = {}) {
  const events = [],
    files = new Map(),
    handles = new Map();
  let next = 1;
  const mock = {
    constants: {
      O_WRONLY: 1,
      O_CREAT: 2,
      O_EXCL: 4,
      O_NOFOLLOW: 8,
      O_RDONLY: 16,
      O_DIRECTORY: 32,
    },
    lstatSync: () => ({ isSymbolicLink: () => false }),
    statSync: () => ({ isDirectory: () => true, uid: 65532, mode: 0o700 }),
    mkdirSync(name) {
      events.push(["mkdir", name]);
      if (existing) throw Error("exists");
    },
    openSync(name, flags) {
      events.push(["open", name]);
      if (name.endsWith(".committed") && failMarker)
        throw Error("marker failed");
      if (flags & 2) {
        if (files.has(name)) throw Error("exists");
        files.set(name, Buffer.alloc(0));
      }
      const fd = next++;
      handles.set(fd, name);
      return fd;
    },
    writeFileSync(fd, bytes) {
      const name = handles.get(fd);
      events.push(["write", name]);
      files.set(name, Buffer.from(bytes));
    },
    fsyncSync(fd) {
      events.push(["sync", handles.get(fd)]);
      if (failAdmissionSync && handles.get(fd).endsWith(".admission"))
        throw Error("admission sync failed");
    },
    closeSync(fd) {
      handles.delete(fd);
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "journal.cjs"), "utf8"),
    {
      module,
      require(name) {
        if (name === "node:fs") return mock;
        if (name === "node:path") return path.posix;
        return require(name);
      },
      process: { platform: "linux", getuid: () => 65532 },
      Buffer,
      structuredClone,
    },
  );
  return {
    journal: module.exports.createPrivateJournal("/run/masarifi-t03/journal"),
    anotherJournal: () =>
      module.exports.createPrivateJournal("/run/masarifi-t03/journal"),
    events,
    files,
  };
}

test("durable status markers follow state-file and parent fsync, identify exact sequence/hash and preserve chain", () => {
  const { journal, events, files } = filesystemBoundary();
  const state = { sessionId: "t03-synthetic", phase: 0, claims: 0 };
  journal.begin(state);
  journal.save({ ...state, phase: 1, claims: 1 });
  for (const sequence of ["00000", "00001"]) {
    const base = "/run/masarifi-t03/journal/t03-synthetic/" + sequence;
    const opened = events.findIndex(
      ([kind, name]) => kind === "open" && name === base + ".committed",
    );
    const synced = events.findIndex(
      ([kind, name]) => kind === "sync" && name === base + ".json",
    );
    assert.ok(synced >= 0 && opened > synced);
    assert.ok(
      events
        .slice(synced + 1, opened)
        .some(
          ([kind, name]) =>
            kind === "sync" &&
            name === "/run/masarifi-t03/journal/t03-synthetic",
        ),
    );
    assert.equal(
      files.get(base + ".committed").toString(),
      sha256(files.get(base + ".json")),
    );
    assert.equal(
      JSON.parse(files.get(base + ".json")).sequence,
      Number(sequence),
    );
  }
  assert.equal(
    JSON.parse(files.get("/run/masarifi-t03/journal/t03-synthetic/00001.json"))
      .previous,
    sha256(files.get("/run/masarifi-t03/journal/t03-synthetic/00000.json")),
  );
});

test("two concurrent successor journals can reserve a given parent only once", async () => {
  const f = filesystemBoundary();
  const other = f.anotherJournal();
  const results = await Promise.allSettled([
    Promise.resolve().then(() =>
      f.journal.beginRestoredSuccessor(restoredState("t03-racing-first")),
    ),
    Promise.resolve().then(() =>
      other.beginRestoredSuccessor(restoredState("t03-racing-second")),
    ),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const failure = results.find((result) => result.status === "rejected");
  assert.match(failure.reason.message, /SUCCESSOR_PARENT_ALREADY_CONSUMED/);
  assert.equal(f.events.filter(([kind]) => kind === "mkdir").length, 1);
});

function restoredState(sessionId = "t03-restored-first") {
  return {
    sessionId,
    phase: 2,
    claims: 1,
    version: 3,
    note: null,
    inflight: null,
    operations: ["original-operation"],
    mutations: ["original-mutation"],
    directReceipts: ["normal-restoration-receipt"],
    restoredSuccessor: {
      kind: "t03-phase2-restored-once",
      parentManifestSha256: "a".repeat(64),
    },
  };
}

test("parent reservation is exclusive across successor IDs and durable before the new journal", () => {
  const f = filesystemBoundary();
  f.journal.beginRestoredSuccessor(restoredState());
  assert.throws(
    () =>
      f.journal.beginRestoredSuccessor(restoredState("t03-restored-second")),
    /SUCCESSOR_PARENT_ALREADY_CONSUMED/,
  );
  const marker =
    "/run/masarifi-t03/journal/restored-parent-" +
    "a".repeat(64) +
    ".admission";
  const markerSync = f.events.findIndex(
    ([kind, name]) => kind === "sync" && name === marker,
  );
  const parentSync = f.events.findIndex(
    ([kind, name], i) =>
      i > markerSync && kind === "sync" && name === "/run/masarifi-t03/journal",
  );
  const mkdir = f.events.findIndex(
    ([kind, name]) => kind === "mkdir" && name.endsWith("t03-restored-first"),
  );
  assert.ok(markerSync >= 0 && parentSync > markerSync && mkdir > parentSync);
  assert.equal(JSON.parse(f.files.get(marker)).sessionId, "t03-restored-first");
  assert.equal(
    f.events.some(
      ([kind, name]) =>
        kind === "mkdir" && name.endsWith("t03-restored-second"),
    ),
    false,
  );
});

test("interrupted parent reservation leaves a terminal marker and creates no child journal", () => {
  const f = filesystemBoundary({ failAdmissionSync: true });
  assert.throws(
    () => f.journal.beginRestoredSuccessor(restoredState()),
    /admission sync failed/,
  );
  assert.throws(
    () =>
      f.journal.beginRestoredSuccessor(restoredState("t03-restored-second")),
    /SUCCESSOR_PARENT_ALREADY_CONSUMED/,
  );
  assert.equal(
    f.events.some(([kind]) => kind === "mkdir"),
    false,
  );
  assert.equal(f.files.size, 1);
});

test("a missing marker fails the save; an existing session cannot reset its stored budget", () => {
  const failed = filesystemBoundary({ failMarker: true });
  assert.throws(
    () =>
      failed.journal.begin({ sessionId: "t03-synthetic", phase: 0, claims: 0 }),
    /marker failed/,
  );
  assert.ok(
    failed.files.has("/run/masarifi-t03/journal/t03-synthetic/00000.json"),
  );
  assert.ok(
    !failed.files.has(
      "/run/masarifi-t03/journal/t03-synthetic/00000.committed",
    ),
  );
  const existing = filesystemBoundary({ existing: true });
  assert.throws(
    () =>
      existing.journal.begin({
        sessionId: "t03-synthetic",
        phase: 0,
        claims: 0,
      }),
    /SESSION_ALREADY_STARTED/,
  );
  assert.equal(existing.files.size, 0);
});
