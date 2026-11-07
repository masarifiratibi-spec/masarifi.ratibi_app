'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {assertSourceMatches}=require('./collect-compatibility.cjs');

test('compatibility evidence is bound to the tested source, including untracked build inputs',t=>{
  assert.equal(typeof assertSourceMatches,'function','SOURCE_PROVENANCE_CHECK_REQUIRED');
  const directory=fs.mkdtempSync(path.join(__dirname,'../../.superpowers/sdd/source-provenance-'));
  t.after(()=>{
    assert(directory.startsWith(path.resolve(__dirname,'../../.superpowers/sdd')+path.sep));
    fs.rmSync(directory,{recursive:true,force:true});
  });
  const git=args=>execFileSync('git',args,{cwd:directory,encoding:'utf8'}).trim();
  git(['init','--quiet']);
  fs.mkdirSync(path.join(directory,'apps/api/src'),{recursive:true});
  const input=path.join(directory,'apps/api/src/input.ts');
  fs.writeFileSync(input,'export const contract=2;\n');
  git(['add','apps/api/src/input.ts']);
  git(['-c','user.name=Compatibility Test','-c','user.email=compatibility@example.invalid','commit','--quiet','-m','Fixture source']);
  const source=git(['rev-parse','HEAD']);
  assert.doesNotThrow(()=>assertSourceMatches(source,directory));
  fs.writeFileSync(input,'export const contract=0;\n');
  assert.throws(()=>assertSourceMatches(source,directory),/TESTED_SOURCE_MISMATCH/);
  fs.writeFileSync(input,'export const contract=2;\n');
  const extra=path.join(directory,'apps/api/src/untracked.ts');
  fs.writeFileSync(extra,'export const hidden=true;\n');
  assert.throws(()=>assertSourceMatches(source,directory),/UNTRACKED_BUILD_INPUT/);
  fs.unlinkSync(extra);
  fs.unlinkSync(input);
  assert.throws(()=>assertSourceMatches(source,directory),/TESTED_SOURCE_MISMATCH/);
});
