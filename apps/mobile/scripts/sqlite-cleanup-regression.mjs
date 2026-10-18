import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { URL } from 'node:url';

const args = process.argv.slice(2);
if (args.length !== 2 && !(args.length === 3 && args[2] === '--real-sqlite'))
  throw new Error('EXPECTED_SQLITE_ROOT_AND_EXTERNAL_OUTPUT');
const [packageRoot, output] = args.slice(0, 2).map((path) => resolve(path));
const source = readFileSync(
  join(
    packageRoot,
    'android/src/main/java/expo/modules/sqlite/SQLiteModule.kt'
  ),
  'utf8'
).replace(/\r\n/g, '\n');
const extract = (pattern, name) => {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1)
    throw new Error('EXACT_SQLITE_METHOD_REQUIRED: ' + name);
  return matches[0][1];
};
const methods = {
  DRAIN: extract(
    /(  @Synchronized\n  private fun removeAllCachedDatabases\(\): List<NativeDatabase> \{[\s\S]*?\n  \})/g,
    'drain'
  ),
  DESTROY: extract(
    /    OnDestroy \{([\s\S]*?)\n    \}\n\n    AsyncFunction/g,
    'destroy'
  ),
  CLOSE: extract(
    /(  @Throws\(AccessClosedResourceException::class, SQLiteErrorException::class\)\n  private fun closeDatabase\(database: NativeDatabase\) \{[\s\S]*?\n  \})/g,
    'close'
  ),
  FINALIZE: extract(
    /(  @Synchronized\n  private fun maybeFinalizeAllStatements\(database: NativeDatabase\) \{[\s\S]*?\n  \})/g,
    'finalize'
  )
};
let fixture = readFileSync(
  new URL(
    args[2]
      ? './fixtures/sqlite-cleanup/RealLifecycleTest.kt'
      : './fixtures/sqlite-cleanup/LifecycleTest.kt',
    import.meta.url
  ),
  'utf8'
);
for (const [name, method] of Object.entries(methods))
  fixture = fixture.replace('@@' + name + '@@', () => method);
mkdirSync(output, { recursive: true });
const kotlinFile = join(output, 'LifecycleTest.kt');
writeFileSync(kotlinFile, fixture);
const cache = join(
  process.env.GRADLE_USER_HOME || join(homedir(), '.gradle'),
  'caches/modules-2/files-2.1'
);
function jar(group, artifact, version) {
  const root = join(cache, group, artifact, version);
  const matches = readdirSync(root).flatMap((hash) =>
    readdirSync(join(root, hash))
      .filter((name) => name === `${artifact}-${version}.jar`)
      .map((name) => join(root, hash, name))
  );
  if (matches.length !== 1)
    throw new Error('EXACT_COMPILER_DEPENDENCY_REQUIRED: ' + artifact);
  return matches[0];
}
const stdlib = jar('org.jetbrains.kotlin', 'kotlin-stdlib', '2.1.20');
const annotations = jar('org.jetbrains', 'annotations', '13.0');
const compiler = [
  jar('org.jetbrains.kotlin', 'kotlin-compiler-embeddable', '2.1.20'),
  stdlib,
  annotations,
  jar('org.jetbrains.kotlin', 'kotlin-script-runtime', '2.1.20'),
  jar('org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'),
  jar('org.jetbrains.intellij.deps', 'trove4j', '1.0.20200330'),
  jar('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0')
].join(delimiter);
const java = process.env.JAVA_HOME
  ? join(process.env.JAVA_HOME, 'bin/java.exe')
  : 'java';
const classes = join(output, 'classes');
const compiled = spawnSync(
  java,
  [
    '-Xmx512m',
    '-cp',
    compiler,
    'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
    '-no-stdlib',
    '-no-reflect',
    '-jvm-target',
    '17',
    '-classpath',
    [stdlib, annotations].join(delimiter),
    '-d',
    classes,
    kotlinFile
  ],
  { encoding: 'utf8', timeout: 60000, windowsHide: true }
);
writeFileSync(
  join(output, 'compile.log'),
  (compiled.stdout || '') + (compiled.stderr || '')
);
if (compiled.status !== 0) throw new Error('KOTLIN_REGRESSION_COMPILE_FAILED');
if (args[2] && !process.env.MASARIFI_TEST_SQLITE_JDBC_CLASSPATH)
  throw new Error('ISOLATED_JDBC_TEST_CLASSPATH_REQUIRED');
const tested = spawnSync(
  java,
  [
    '-Xmx128m',
    '-cp',
    [classes, stdlib, process.env.MASARIFI_TEST_SQLITE_JDBC_CLASSPATH]
      .filter(Boolean)
      .join(delimiter),
    'LifecycleTestKt'
  ],
  { encoding: 'utf8', timeout: 10000, windowsHide: true }
);
writeFileSync(
  join(output, 'result.log'),
  (tested.stdout || '') + (tested.stderr || '')
);
console.log(tested.stdout);
process.exitCode = tested.status === 0 ? 0 : 1;
