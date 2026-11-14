const fs = require("node:fs");
const path = require("node:path");
const { createRequire, isBuiltin } = require("node:module");
const {
  sha256,
  requireCondition: requireThat,
} = require("../t03-exact-sync/manifest.cjs");
const {
  IMAGE,
  contained,
  assertNoLinks,
  fileList,
  verifyPackage,
} = require("./artifact.cjs");
const SOURCE_ROOT = path.resolve(__dirname, "../../..");
const API_ROOT = path.join(SOURCE_ROOT, "apps/api");
function requiredModules(ts, text, file) {
  const parsed = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const names = new Set();
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    )
      names.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return names;
}

async function buildPackage(output, dependencyProof) {
  const preparationRoot = path.join(
    SOURCE_ROOT,
    ".superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/session-consumer-prep/packages",
  );
  contained(preparationRoot, output);
  assertNoLinks(output);
  fs.mkdirSync(output, { recursive: false });
  const apiRequire = createRequire(path.join(API_ROOT, "package.json"));
  const ts = apiRequire("typescript");
  const options = ts.readConfigFile(
    path.join(API_ROOT, "tsconfig.json"),
    ts.sys.readFile,
  ).config.compilerOptions;
  const converted = ts.convertCompilerOptionsFromJson(options, API_ROOT);
  requireThat(converted.errors.length === 0, "QA_COMPILE_OPTIONS");
  const emitted = new Map();
  const program = ts.createProgram(
    [
      "src/sync/claimed-mutation.runtime.ts",
      "src/platform/config/environment.schema.ts",
    ].map((entry) => path.join(API_ROOT, entry)),
    {
      ...converted.options,
      types: ["node"],
      typeRoots: [path.join(API_ROOT, "node_modules/@types")],
      incremental: false,
      declaration: false,
      sourceMap: false,
      rootDir: path.join(API_ROOT, "src"),
      outDir: path.join(output, "compiled"),
    },
  );
  const diagnostics = ts.getPreEmitDiagnostics(program);
  requireThat(diagnostics.length === 0, "QA_COMPILE_DIAGNOSTICS");
  const result = program.emit(
    undefined,
    (file, content, _bom, _onError, sources) =>
      emitted.set(path.resolve(file), { content, sources }),
  );
  requireThat(
    !result.emitSkipped && result.diagnostics.length === 0,
    "QA_COMPILE_FAILED",
  );
  const external = new Set(["pg"]);
  const visited = new Set();
  const sourceFiles = new Set();
  function shipEmitted(full) {
    if (visited.has(full)) return;
    visited.add(full);
    const entry = emitted.get(full);
    requireThat(entry, "QA_COMPILED_DEPENDENCY_MISSING");
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, entry.content, { flag: "wx" });
    for (const source of entry.sources ?? []) sourceFiles.add(source.fileName);
    for (const name of requiredModules(ts, entry.content, full)) {
      if (name.startsWith("."))
        shipEmitted(path.resolve(path.dirname(full), `${name}.js`));
      else if (!isBuiltin(name)) external.add(name);
    }
  }
  shipEmitted(path.join(output, "compiled/sync/claimed-mutation.runtime.js"));
  shipEmitted(
    path.join(output, "compiled/platform/config/environment.schema.js"),
  );
  function copyFile(from, destination) {
    assertNoLinks(from);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(from, destination, fs.constants.COPYFILE_EXCL);
  }
  // Source bytes accompany compiled closure so the exact guard's normal source pins remain verifiable.
  for (const file of sourceFiles)
    copyFile(
      file,
      path.join(output, "source", path.relative(SOURCE_ROOT, file)),
    );
  for (const [directory, runtimeFiles] of [
    [
      "t03-exact-sync",
      ["runner.cjs", "manifest.cjs", "catalog.sql", "manifest.template.json"],
    ],
    [
      "t03-session-consumer",
      [
        "adapter.cjs",
        "artifact.cjs",
        "config.cjs",
        "session.cjs",
        "successor.cjs",
        "journal.cjs",
        "host-entry.cjs",
        "host_broker.py",
        "host_transport.py",
        "inspection-scope.json",
        "diagnostic-codes.json",
        "session.template.json",
      ],
    ],
  ]) {
    for (const file of runtimeFiles) {
      const relative = `scripts/qa/${directory}/${file}`;
      copyFile(path.join(SOURCE_ROOT, relative), path.join(output, relative));
      copyFile(
        path.join(SOURCE_ROOT, relative),
        path.join(output, "source", relative),
      );
    }
  }
  const modulesRoot = path.join(API_ROOT, "node_modules");
  const packages = new Map();
  function locatePackage(name, from) {
    const resolver = createRequire(path.join(from, "package.json"));
    let entry;
    try {
      entry = resolver.resolve(`${name}/package.json`);
    } catch {
      entry = resolver.resolve(name);
      while (!fs.existsSync(path.join(path.dirname(entry), "package.json")))
        entry = path.dirname(entry);
      entry = path.join(path.dirname(entry), "package.json");
    }
    return path.dirname(entry);
  }
  function shipPackage(name, from) {
    const directory = locatePackage(name, from);
    contained(modulesRoot, directory);
    if (packages.has(directory)) return;
    const json = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    packages.set(directory, {
      name: json.name,
      version: json.version,
      path: `node_modules/${path.relative(modulesRoot, directory).replaceAll(path.sep, "/")}`,
    });
    function copyTree(cursor) {
      for (const entry of fs.readdirSync(cursor, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        requireThat(!entry.isSymbolicLink(), "QA_DEPENDENCY_SYMLINK");
        const full = path.join(cursor, entry.name);
        if (entry.isDirectory()) copyTree(full);
        else {
          requireThat(
            entry.isFile() && !/\.(node|exe|dll)$/i.test(entry.name),
            "QA_DEPENDENCY_NATIVE_BINARY",
          );
          copyFile(
            full,
            path.join(output, "node_modules", path.relative(modulesRoot, full)),
          );
        }
      }
    }
    copyTree(directory);
    for (const dependency of Object.keys(json.dependencies ?? {}))
      shipPackage(dependency, directory);
    for (const dependency of Object.keys(json.peerDependencies ?? {})) {
      try {
        locatePackage(dependency, directory);
      } catch {
        requireThat(
          json.peerDependenciesMeta?.[dependency]?.optional === true,
          "QA_PEER_DEPENDENCY_MISSING",
        );
        continue;
      }
      shipPackage(dependency, directory);
    }
  }
  let imageDependencies;
  if (dependencyProof) {
    requireThat(
      sha256(fs.readFileSync(dependencyProof.path)) === dependencyProof.sha256,
      "QA_DEPENDENCY_PROOF_PIN",
    );
    const proof = JSON.parse(fs.readFileSync(dependencyProof.path, "utf8"));
    requireThat(
      proof.version === 1 &&
        proof.image === IMAGE &&
        proof.dependencies.length > 0,
      "QA_DEPENDENCY_PROOF_INVALID",
    );
    const resolutions = [];
    function recordResolution(name, from, label) {
      const resolver = createRequire(path.join(from, "package.json"));
      let request = name;
      let resolved;
      try {
        resolved = resolver.resolve(name);
      } catch (error) {
        const directory = locatePackage(name, from);
        const pkg = JSON.parse(
          fs.readFileSync(path.join(directory, "package.json"), "utf8"),
        );
        const prefix = `node_modules/${path.relative(modulesRoot, directory).replaceAll(path.sep, "/")}/`;
        const typeOnly =
          pkg.types &&
          !pkg.main &&
          proof.files
            .filter((file) => file.path.startsWith(prefix))
            .every((file) => !/\.(js|cjs|mjs|node|wasm)$/.test(file.path));
        if (!name.startsWith("@types/") && !typeOnly) throw error;
        request = `${name}/package.json`;
        resolved = resolver.resolve(request);
      }
      contained(modulesRoot, resolved);
      resolutions.push({
        from: label,
        request,
        resolved: `node_modules/${path.relative(modulesRoot, resolved).replaceAll(path.sep, "/")}`,
      });
    }
    for (const name of external) recordResolution(name, API_ROOT, "compiled");
    for (const dependency of proof.dependencies) {
      const directory = contained(
        API_ROOT,
        path.join(API_ROOT, dependency.path),
      );
      const pkg = JSON.parse(
        fs.readFileSync(path.join(directory, "package.json"), "utf8"),
      );
      requireThat(
        pkg.name === dependency.name && pkg.version === dependency.version,
        "QA_DEPENDENCY_VERSION_DRIFT",
      );
      packages.set(directory, dependency);
      for (const name of new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.peerDependencies ?? {}),
      ])) {
        try {
          locatePackage(name, directory);
        } catch {
          requireThat(
            pkg.peerDependenciesMeta?.[name]?.optional === true,
            "QA_DEPENDENCY_RESOLUTION_MISSING",
          );
          continue;
        }
        recordResolution(name, directory, dependency.path);
      }
    }
    imageDependencies = {
      root: "/app/node_modules",
      proofManifestSha256: dependencyProof.sha256,
      files: proof.files.filter((file) =>
        file.path.startsWith("node_modules/"),
      ),
      resolutions,
    };
    requireThat(
      imageDependencies.files.length > 0,
      "QA_DEPENDENCY_PROOF_EMPTY",
    );
  } else for (const name of external) shipPackage(name, API_ROOT);
  const files = fileList(output).map((full) => ({
    path: path.relative(output, full).replaceAll(path.sep, "/"),
    bytes: fs.statSync(full).size,
    sha256: sha256(fs.readFileSync(full)),
  }));
  const manifest = {
    version: 1,
    image: IMAGE,
    node: {
      build: process.version,
      target: "v24.20.0",
      platform: "linux",
      architecture: "x64",
    },
    typescript: ts.version,
    dependencies: [...packages.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
    ...(imageDependencies ? { imageDependencies } : {}),
    files,
  };
  fs.writeFileSync(
    path.join(output, "package-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx" },
  );
  return manifest;
}

module.exports = { IMAGE, buildPackage, verifyPackage };

if (require.main === module) {
  if (process.argv.length !== 4 || process.argv[2] !== "--build") {
    process.stderr.write(
      "Usage: node package.cjs --build <new-local-preparation-directory>\n",
    );
    process.exitCode = 2;
  } else
    buildPackage(path.resolve(process.argv[3]))
      .then((manifest) =>
        process.stdout.write(
          `Prepared ${manifest.files.length} pinned files; no connection or execution.\n`,
        ),
      )
      .catch(() => {
        process.stderr.write("QA_PACKAGE_PREPARATION_FAILED\n");
        process.exitCode = 1;
      });
}
