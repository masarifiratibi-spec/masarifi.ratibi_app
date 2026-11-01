import { open } from 'node:fs/promises';

const descriptor =
  'expo.modules.kotlin.records.RecordTypeConverter$PropertyDescriptor';

async function checkMapping(mappingPath) {
  const file = await open(mappingPath, 'r');
  let isR8 = false;
  let currentClass;
  let descriptorCount = 0;
  let fieldCount = 0;
  try {
    // Stream the compiler artifact: release mappings can exceed 100 MB.
    for await (const line of file.readLines()) {
      if (line === '# compiler: R8') isR8 = true;
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      const header = /^(\S+) -> (\S+):$/.exec(line);
      if (header) {
        currentClass = header[1];
        if (currentClass === descriptor) descriptorCount++;
        continue;
      }
      if (!currentClass || !/^\s+\S.* -> \S+$/.test(line)) {
        throw new Error('R8_MAPPING_MALFORMED');
      }
      if (
        currentClass === descriptor &&
        /^\s+expo\.modules\.kotlin\.records\.Field fieldAnnotation -> [^\s:]+$/.test(
          line
        )
      ) {
        fieldCount++;
      }
    }
  } finally {
    await file.close();
  }
  if (!isR8 || descriptorCount > 1 || fieldCount > 1) {
    throw new Error('R8_MAPPING_MALFORMED');
  }
  if (!descriptorCount) throw new Error('R8_RECORD_DESCRIPTOR_MISSING');
  if (!fieldCount) throw new Error('R8_RECORD_FIELD_MISSING');
}

try {
  if (process.argv.length !== 3 || !process.argv[2].trim()) {
    throw new Error('R8_MAPPING_PATH_REQUIRED');
  }
  await checkMapping(process.argv[2]);
  process.stdout.write(
    JSON.stringify({ ok: true, code: 'R8_RECORD_FIELD_RETAINED' }) + '\n'
  );
} catch (error) {
  const code = /^R8_[A-Z_]+$/.test(error.message)
    ? error.message
    : 'R8_MAPPING_UNREADABLE';
  process.stdout.write(JSON.stringify({ ok: false, code }) + '\n');
  process.exitCode = 1;
}
