import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const script = fileURLToPath(
  new URL('./check-record-reflection.mjs', import.meta.url)
);
const header =
  'expo.modules.kotlin.records.RecordTypeConverter$PropertyDescriptor -> vw.c:';
// The failed 16304ecf artifact retained the constructor's Field argument but removed its field.
const removed = `# compiler: R8
${header}
# {"id":"sourceFile","fileName":"RecordTypeConverter.kt"}
    expo.modules.kotlin.types.TypeConverter typeConverter -> a
    boolean isRequired -> b
    6:8:void <init>(expo.modules.kotlin.types.TypeConverter,expo.modules.kotlin.records.Field,boolean):150:150 -> <init>
      # {"id":"com.android.tools.r8.residualsignature","signature":"(Lbx/j0;Lvw/a;Z)V"}
`;
const retained = `${removed}    expo.modules.kotlin.records.Field fieldAnnotation -> renamedAnnotation
expo.modules.kotlin.records.Required -> required.Annotation:
`;

async function inspect(t, mapping) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'masarifi-record-mapping-')
  );
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  const mappingPath = path.join(directory, 'mapping $(noop) & [sample].txt');
  if (mapping !== null) await writeFile(mappingPath, mapping);
  const result = spawnSync(process.execPath, [script, mappingPath], {
    encoding: 'utf8'
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stderr, '');
  return { status: result.status, output: JSON.parse(result.stdout) };
}

test('accepts the retained Field reference despite class and field renaming', async (t) => {
  assert.deepEqual(await inspect(t, retained.replaceAll('\n', '\r\n')), {
    status: 0,
    output: { ok: true, code: 'R8_RECORD_FIELD_RETAINED' }
  });
});

for (const [name, mapping, code] of [
  [
    'rejects the actual removed-field shape even though constructors mention Field',
    removed,
    'R8_RECORD_FIELD_MISSING'
  ],
  [
    'rejects a same-name field in a different class',
    `${removed}another.Class -> a:\n    expo.modules.kotlin.records.Field fieldAnnotation -> b\n`,
    'R8_RECORD_FIELD_MISSING'
  ],
  [
    'rejects a field with the wrong annotation type',
    retained.replace('Field fieldAnnotation', 'Required fieldAnnotation'),
    'R8_RECORD_FIELD_MISSING'
  ],
  [
    'rejects a method masquerading as the field',
    retained.replace('fieldAnnotation ->', 'fieldAnnotation() ->'),
    'R8_RECORD_FIELD_MISSING'
  ],
  [
    'rejects an absent descriptor',
    '# compiler: R8\nanother.Class -> a:\n',
    'R8_RECORD_DESCRIPTOR_MISSING'
  ],
  [
    'rejects duplicate descriptor blocks',
    retained + retained,
    'R8_MAPPING_MALFORMED'
  ],
  [
    'rejects duplicate annotation fields',
    retained.replace(
      'expo.modules.kotlin.records.Required -> required.Annotation:',
      '    expo.modules.kotlin.records.Field fieldAnnotation -> second'
    ),
    'R8_MAPPING_MALFORMED'
  ],
  [
    'rejects a malformed member after a valid field',
    retained + '    broken member\n',
    'R8_MAPPING_MALFORMED'
  ],
  [
    'rejects a malformed class header',
    retained.replace(' -> vw.c:', ' -> vw.c'),
    'R8_MAPPING_MALFORMED'
  ],
  ['rejects empty output', '', 'R8_MAPPING_MALFORMED'],
  [
    'rejects a non-R8 mapping',
    retained.replace('# compiler: R8\n', ''),
    'R8_MAPPING_MALFORMED'
  ],
  [
    'rejects a missing file without exposing its path',
    null,
    'R8_MAPPING_UNREADABLE'
  ]
]) {
  test(name, async (t) => {
    assert.deepEqual(await inspect(t, mapping), {
      status: 1,
      output: { ok: false, code }
    });
  });
}

test('requires exactly one mapping path argument', () => {
  for (const args of [[], ['one', 'two']]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: false,
      code: 'R8_MAPPING_PATH_REQUIRED'
    });
  }
});
