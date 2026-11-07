const fs = require("node:fs");
const path = require("node:path");
const {
  sha256,
  canonical,
  requireCondition: requireThat,
} = require("../t03-exact-sync/manifest.cjs");

function createPrivateJournal(root) {
  requireThat(
    process.platform === "linux" && process.getuid() === 65532,
    "SESSION_JOURNAL_PLATFORM_IDENTITY",
  );
  requireThat(
    path.resolve(root) === "/run/masarifi-t03/journal",
    "SESSION_JOURNAL_PATH",
  );
  let cursor = root;
  while (true) {
    requireThat(
      !fs.lstatSync(cursor).isSymbolicLink(),
      "SESSION_JOURNAL_SYMLINK",
    );
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const identity = fs.statSync(root);
  requireThat(
    identity.isDirectory() &&
      identity.uid === 65532 &&
      (identity.mode & 0o777) === 0o700,
    "SESSION_JOURNAL_PERMISSIONS",
  );
  let sequence = 0;
  let directory;
  let previous = null;
  function save(state) {
    requireThat(directory, "SESSION_JOURNAL_NOT_BEGUN");
    const bytes = Buffer.from(
      JSON.stringify({ sequence, previous, state }, null, 2) + "\n",
    );
    const fd = fs.openSync(
      path.join(directory, `${String(sequence).padStart(5, "0")}.json`),
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_NOFOLLOW,
      0o600,
    );
    try {
      fs.writeFileSync(fd, bytes);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    const parent = fs.openSync(
      directory,
      fs.constants.O_RDONLY |
        fs.constants.O_DIRECTORY |
        fs.constants.O_NOFOLLOW,
    );
    try {
      fs.fsyncSync(parent);
    } finally {
      fs.closeSync(parent);
    }
    // Visibility of JSON alone is not a durable-status acknowledgement. This
    // marker is created only after both the state and its directory are synced.
    const marker = fs.openSync(
      path.join(directory, `${String(sequence).padStart(5, "0")}.committed`),
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_NOFOLLOW,
      0o600,
    );
    try {
      fs.writeFileSync(marker, sha256(bytes));
      fs.fsyncSync(marker);
    } finally {
      fs.closeSync(marker);
    }
    const committedParent = fs.openSync(
      directory,
      fs.constants.O_RDONLY |
        fs.constants.O_DIRECTORY |
        fs.constants.O_NOFOLLOW,
    );
    try {
      fs.fsyncSync(committedParent);
    } finally {
      fs.closeSync(committedParent);
    }
    previous = sha256(bytes);
    sequence += 1;
  }
  function begin(state) {
    requireThat(
      !directory && /^t03-[a-z0-9-]{1,100}$/.test(state.sessionId),
      "SESSION_JOURNAL_IDENTITY",
    );
    directory = path.join(root, state.sessionId);
    // Any existing journal stops; a new invocation cannot reset its consumed budget.
    try {
      fs.mkdirSync(directory, { mode: 0o700 });
    } catch {
      throw new Error("SESSION_ALREADY_STARTED");
    }
    const parent = fs.openSync(
      root,
      fs.constants.O_RDONLY |
        fs.constants.O_DIRECTORY |
        fs.constants.O_NOFOLLOW,
    );
    try {
      fs.fsyncSync(parent);
    } finally {
      fs.closeSync(parent);
    }
    save(structuredClone(state));
  }
  return Object.freeze({
    begin,
    beginRestoredSuccessor(state) {
      requireThat(
        state.restoredSuccessor?.kind === "t03-phase2-restored-once" &&
          /^[a-f0-9]{64}$/.test(
            state.restoredSuccessor.parentManifestSha256 ?? "",
          ) &&
          state.phase === 2 &&
          state.claims === 1 &&
          state.version === 3 &&
          state.note === null &&
          state.inflight === null &&
          state.operations.length === 1 &&
          state.mutations.length === 1 &&
          state.directReceipts.length === 1,
        "SUCCESSOR_JOURNAL_SEED_REQUIRED",
      );
      const markerPath = path.join(
        root,
        `restored-parent-${state.restoredSuccessor.parentManifestSha256}.admission`,
      );
      let marker;
      try {
        marker = fs.openSync(
          markerPath,
          fs.constants.O_WRONLY |
            fs.constants.O_CREAT |
            fs.constants.O_EXCL |
            fs.constants.O_NOFOLLOW,
          0o600,
        );
      } catch {
        throw new Error("SUCCESSOR_PARENT_ALREADY_CONSUMED");
      }
      try {
        fs.writeFileSync(
          marker,
          canonical({
            sessionId: state.sessionId,
            seedSha256: sha256(canonical(state)),
            proof: state.restoredSuccessor,
          }),
        );
        fs.fsyncSync(marker);
      } finally {
        fs.closeSync(marker);
      }
      const parent = fs.openSync(
        root,
        fs.constants.O_RDONLY |
          fs.constants.O_DIRECTORY |
          fs.constants.O_NOFOLLOW,
      );
      try {
        fs.fsyncSync(parent);
      } finally {
        fs.closeSync(parent);
      }
      // A partial reservation remains terminal for this parent. Never unlink or retry it.
      begin(state);
    },
    save(state) {
      save(JSON.parse(canonical(state)));
    },
  });
}
module.exports = { createPrivateJournal };
