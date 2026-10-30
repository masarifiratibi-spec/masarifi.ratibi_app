const fs = require("node:fs");
const path = require("node:path");
const {
  canonical,
  sha256,
  requireCondition: requireThat,
} = require("../t03-exact-sync/manifest.cjs");

const IMAGE =
  "ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383";

function contained(root, input) {
  const full = path.resolve(input);
  const relative = path.relative(root, full);
  requireThat(
    relative &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative),
    "QA_PACKAGE_PATH",
  );
  return full;
}

function assertNoLinks(full) {
  let cursor = path.resolve(full);
  while (true) {
    if (fs.existsSync(cursor))
      requireThat(!fs.lstatSync(cursor).isSymbolicLink(), "QA_PACKAGE_SYMLINK");
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

function fileList(root) {
  const result = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      requireThat(!entry.isSymbolicLink(), "QA_PACKAGE_SYMLINK");
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        requireThat(entry.isFile(), "QA_PACKAGE_SPECIAL_FILE");
        result.push(full);
      }
    }
  }
  walk(root);
  return result.sort();
}

function verifyPackage(root, expectedHash) {
  assertNoLinks(root);
  const manifestPath = path.join(root, "package-manifest.json");
  requireThat(
    /^[a-f0-9]{64}$/.test(expectedHash ?? "") &&
      sha256(fs.readFileSync(manifestPath)) === expectedHash,
    "QA_PACKAGE_PIN_REQUIRED",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  requireThat(
    manifest.version === 1 &&
      manifest.image === IMAGE &&
      Array.isArray(manifest.files),
    "QA_PACKAGE_MANIFEST",
  );
  const expected = manifest.files.map((file) => file.path).sort();
  const actual = fileList(root)
    .map((full) => path.relative(root, full).replaceAll(path.sep, "/"))
    .filter((file) => file !== "package-manifest.json");
  requireThat(
    canonical(actual.sort()) === canonical(expected),
    "QA_PACKAGE_FILE_SET_MISMATCH",
  );
  for (const file of manifest.files) {
    const full = contained(root, path.join(root, file.path));
    requireThat(
      sha256(fs.readFileSync(full)) === file.sha256 &&
        fs.statSync(full).size === file.bytes,
      "QA_PACKAGE_FILE_MISMATCH",
    );
  }
  if (manifest.imageDependencies)
    verifyImageDependencies(root, manifest.imageDependencies);
  return manifest;
}

function verifyImageDependencies(root, dependencies) {
  requireThat(
    process.platform === "linux" &&
      dependencies.root === "/app/node_modules" &&
      root === "/app/qa-t03",
    "QA_IMAGE_DEPENDENCY_ROOT_UNVERIFIED",
  );
  for (const file of dependencies.files) {
    const full = contained("/app", path.join("/app", file.path));
    requireThat(
      file.path.startsWith("node_modules/"),
      "QA_IMAGE_DEPENDENCY_PATH",
    );
    try {
      assertNoLinks(full);
      requireThat(
        fs.statSync(full).isFile() &&
          fs.statSync(full).size === file.bytes &&
          sha256(fs.readFileSync(full)) === file.sha256,
        "QA_IMAGE_DEPENDENCY_CONTENT_MISMATCH",
      );
    } catch {
      throw Object.assign(new Error("QA_IMAGE_DEPENDENCY_CONTENT_MISMATCH"), {
        publicPath: file.path,
      });
    }
  }
  for (const edge of dependencies.resolutions) {
    const from =
      edge.from === "compiled"
        ? path.join(root, "compiled/package.json")
        : path.join("/app", edge.from, "package.json");
    try {
      const resolved = require("node:module")
        .createRequire(from)
        .resolve(edge.request);
      requireThat(
        resolved === path.join("/app", edge.resolved),
        "QA_IMAGE_DEPENDENCY_RESOLUTION_MISMATCH",
      );
    } catch {
      throw Object.assign(
        new Error("QA_IMAGE_DEPENDENCY_RESOLUTION_MISMATCH"),
        { publicPath: edge.resolved },
      );
    }
  }
}

module.exports = { IMAGE, contained, assertNoLinks, fileList, verifyPackage };
