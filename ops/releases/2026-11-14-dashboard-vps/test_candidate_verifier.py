"""Offline checks: no network, artifact execution, build or disk extraction."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

from candidate_verifier import VerificationError, verify_candidate, validate_runtime_members

APP = "apps/admin-web"
API = ["apps/api/src/reports/reports.admin.ts", "apps/api/src/reports/reports.admin-types.ts"]
NEXT_ENV_FIXTURE = (b'/// <reference types="next" />\n'
    b'/// <reference types="next/image-types/global" />\n'
    b'import "./.next/types/routes.d.ts";\n'
    b'import "./.next/types/root-params.d.ts";\n\n'
    b'// NOTE: This file should not be edited\n'
    b'// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.\n')

class CandidateVerificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git("init", "-q")
        self.git("config", "user.name", "Offline fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.source = {
            APP+"/package.json": json.dumps({"dependencies": {"next": "16.3.8"}}).encode(),
            APP+"/package-lock.json": json.dumps({"packages": {"node_modules/next": {"version": "16.3.8"}}}).encode(),
            APP+"/next-env.d.ts": NEXT_ENV_FIXTURE,
            APP+"/next.config.ts": b"export default {};\n",
            APP+"/tsconfig.json": b"{}\n",
            APP+"/src/core/config/runtime.ts": b"export const mode = 'live';\n",
            APP+"/src/core/config/server-runtime.ts": b"export const server = true;\n",
            API[0]: b"export const report = true;\n",
            API[1]: b"export type Report = string;\n",
        }
        for name, body in self.source.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        self.git("add", ".")
        self.git("commit", "-qm", "source")
        self.commit = self.git("rev-parse", "HEAD").strip()
        source_archive = self.git_bytes("archive", "--format=tar", self.commit, APP, *API)
        self.manifest = {
            "sourceSha": self.commit, "adminGitTree": self.git("rev-parse", self.commit+":"+APP).strip(),
            "sourceArchivePaths": [APP, *API], "sourceArchiveSha256": self.sha(source_archive),
            "lockSha256": self.sha(self.source[APP+"/package-lock.json"]),
            "node": "v24.16.0", "npm": "11.17.0", "buildId": "offline-build",
            "runtimeSecretsIncluded": False,
            "publicConfigurationSha256": {key:self.sha(key.encode()) for key in [
                "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "NEXT_PUBLIC_CLIENT_MODE",
                "NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT", "NEXT_PUBLIC_ENABLE_MOCKS"]},
        }
        self.files = {**self.source,
            APP+"/.next/BUILD_ID": b"offline-build\n",
            APP+"/.next/required-server-files.json": json.dumps({"files":[".next/BUILD_ID"]}).encode(),
            APP+"/node_modules/next/package.json": b'{"version":"16.3.8"}',
            APP+"/.next/static/chunks/styles.css": b"body{margin:0}\n",
        }
        self.archive = self.root / "runtime.tar.gz"
        self.manifest_path = self.root / "manifest.json"
        self.pins = {key:self.manifest[key] for key in ["adminGitTree", "buildId", "lockSha256", "sourceArchiveSha256"]}
        self.pins.update(sourceCommit=self.commit, compatibleCommit=self.commit)
        self.repack()

    @staticmethod
    def sha(body): return hashlib.sha256(body).hexdigest()
    def git_bytes(self, *args): return subprocess.check_output(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", *args], cwd=self.root, stderr=subprocess.PIPE)
    def git(self, *args): return self.git_bytes(*args).decode()
    def repack(self, extras=()):
        with tarfile.open(self.archive, "w:gz") as bundle:
            for name, body in self.files.items():
                item=tarfile.TarInfo(name); item.size=len(body)
                bundle.addfile(item, io.BytesIO(body))
            for item in extras: bundle.addfile(item, io.BytesIO(b"x"*item.size) if item.isfile() else None)
        self.manifest_path.write_text(json.dumps(self.manifest))
        self.pins.update(archiveSha256=self.sha(self.archive.read_bytes()), archiveBytes=self.archive.stat().st_size,
                         manifestSha256=self.sha(self.manifest_path.read_bytes()))
    def verify(self): return verify_candidate(self.root, self.archive, self.manifest_path, self.pins)

    def test_all_sources_and_static_inventory_are_bound_to_git_and_pins(self):
        report, static = self.verify()
        self.assertEqual(report["sourceFilesVerified"], 9)
        self.assertEqual(report["generatedNextEnvRewrites"], [])
        self.assertEqual(static, [{"path":APP+"/.next/static/chunks/styles.css", "sha256":self.sha(b"body{margin:0}\n"), "bytes":15}])
        self.assertTrue(report["verified"])

    def test_unsafe_archive_members_fail_after_hash_repinning(self):
        with tarfile.open(self.archive) as bundle: base_members=bundle.getmembers()
        cases = []
        for name in ["../escape", "/escape", APP+"/../escape", APP+"/x\\escape", APP+"/.env", APP+"/nested/server.env", APP+"/src/.env.local", "apps/api/src/extra.ts", APP+"/package.json", APP+"/node_modules/hidden\nname"]:
            item=tarfile.TarInfo(name); item.size=1; cases.append([item])
        for target in ["/etc/passwd", "../../../escape", "../.env", "../../admin-web/.env", "next/package.json\n"]:
            item=tarfile.TarInfo(APP+"/node_modules/link"); item.type=tarfile.SYMTYPE; item.linkname=target; cases.append([item])
        hard=tarfile.TarInfo(APP+"/hard"); hard.type=tarfile.LNKTYPE; hard.linkname=APP+"/package.json"; cases.append([hard])
        link=tarfile.TarInfo(APP+"/symlink"); link.type=tarfile.SYMTYPE; link.linkname="src"
        child=tarfile.TarInfo(APP+"/symlink/child"); child.size=1; cases.append([link,child])
        first=tarfile.TarInfo(APP+"/node_modules/first"); first.type=tarfile.SYMTYPE; first.linkname="second"
        second=tarfile.TarInfo(APP+"/node_modules/second"); second.type=tarfile.SYMTYPE; second.linkname="next/package.json"
        cases.append([first,second])
        for extras in cases:
            with self.subTest(member=extras[0].name, target=extras[0].linkname):
                self.repack(extras)
                with self.assertRaises(VerificationError): self.verify()
                with self.assertRaises(VerificationError): validate_runtime_members([*base_members,*extras])

    def test_safe_internal_dependency_symlinks_remain_supported(self):
        link=tarfile.TarInfo(APP+"/node_modules/next-link"); link.type=tarfile.SYMTYPE; link.linkname="next/package.json"
        self.repack([link])
        report,_=self.verify()
        self.assertEqual(report["symlinkCount"],1)

    def test_changed_missing_and_untracked_sources_fail_even_after_archive_repin(self):
        original=dict(self.files)
        for change in ["changed", "missing", "untracked"]:
            with self.subTest(change=change):
                self.files=dict(original)
                if change=="changed": self.files[API[0]]=b"changed\n"
                elif change=="missing": self.files.pop(APP+"/src/core/config/runtime.ts")
                else: self.files[APP+"/src/untracked.ts"]=b"unexpected\n"
                self.repack()
                with self.assertRaises(VerificationError): self.verify()

    def test_manifest_build_lock_and_source_archive_pin_mismatches_fail(self):
        original=dict(self.manifest)
        for key, altered in [("buildId","wrong"),("lockSha256","a"*64),("sourceArchiveSha256","a"*64),("runtimeSecretsIncluded",True),("node","v1"),("npm","1"),("sourceArchivePaths",[APP])]:
            with self.subTest(key=key):
                self.manifest={**original,key:altered}; self.repack()
                with self.assertRaises(VerificationError): self.verify()
        self.manifest=original; self.repack(); self.pins["archiveSha256"]="f"*64
        with self.assertRaises(VerificationError): self.verify()
        self.repack(); self.pins["manifestSha256"]="f"*64
        with self.assertRaises(VerificationError): self.verify()

    def test_compatible_commit_must_also_preserve_both_report_sources(self):
        (self.root/API[1]).write_text("changed\n")
        self.git("add", "."); self.git("commit", "-qm", "report drift")
        self.pins["compatibleCommit"]=self.git("rev-parse", "HEAD").strip()
        with self.assertRaises(VerificationError): self.verify()

    def test_only_the_exact_canonical_next_env_build_rewrite_is_accepted(self):
        self.files[APP+"/next-env.d.ts"]=b"arbitrary build rewrite\n"; self.repack()
        with self.assertRaises(VerificationError): self.verify()

    def test_canonical_next_env_rewrite_is_explicitly_recorded(self):
        historical=b"// tracked historical type reference\\n"
        (self.root/APP/"next-env.d.ts").write_bytes(historical)
        self.git("add", APP+"/next-env.d.ts"); self.git("commit", "-qm", "historical reference")
        self.commit=self.git("rev-parse", "HEAD").strip()
        tree=self.git("rev-parse", self.commit+":"+APP).strip()
        archive_hash=self.sha(self.git_bytes("archive", "--format=tar", self.commit, APP, *API))
        self.manifest.update(sourceSha=self.commit,adminGitTree=tree,sourceArchiveSha256=archive_hash)
        self.pins.update(sourceCommit=self.commit,compatibleCommit=self.commit,adminGitTree=tree,sourceArchiveSha256=archive_hash)
        self.repack()
        report,_=self.verify()
        self.assertEqual(report["generatedNextEnvRewrites"],[APP+"/next-env.d.ts"])

    def test_required_generated_files_and_declared_runtime_files_must_exist(self):
        for filename in [APP+"/.next/BUILD_ID", APP+"/node_modules/next/package.json"]:
            with self.subTest(filename=filename):
                body=self.files.pop(filename); self.repack()
                with self.assertRaises(VerificationError): self.verify()
                self.files[filename]=body
        self.files[APP+"/.next/required-server-files.json"]=b'{"files":["../../outside"]}'; self.repack()
        with self.assertRaises(VerificationError): self.verify()

    def test_cli_replaces_stale_success_after_rejection_without_changing_inputs(self):
        script=Path(__file__).with_name("candidate_verifier.py").resolve()
        pins_path=self.root/"pins.json"; self.pins["archiveSha256"]="0"*64
        pins_path.write_text(json.dumps(self.pins))
        report=self.root/"report.json"; report.write_text('{"verified":true}')
        inventory=self.root/"static.json"
        original_archive=self.archive.read_bytes()
        result=subprocess.run([sys.executable,"-B",str(script),"--root",str(self.root),"--archive",str(self.archive),
            "--manifest",str(self.manifest_path),"--pins",str(pins_path),"--report",str(report),"--static-inventory",str(inventory)],capture_output=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIs(json.loads(report.read_text())["verified"],False)
        self.assertEqual(self.archive.read_bytes(),original_archive)

    def test_cli_rejects_output_paths_that_would_overwrite_an_input(self):
        script=Path(__file__).with_name("candidate_verifier.py").resolve()
        pins_path=self.root/"pins.json"; pins_path.write_text(json.dumps(self.pins))
        original_archive=self.archive.read_bytes()
        result=subprocess.run([sys.executable,"-B",str(script),"--root",str(self.root),"--archive",str(self.archive),
            "--manifest",str(self.manifest_path),"--pins",str(pins_path),"--report",str(self.archive),"--static-inventory",str(self.root/"static.json")],capture_output=True)
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.archive.read_bytes(),original_archive)

if __name__ == "__main__": unittest.main()
