"""Read-only, streaming Admin artifact admission. Never extracts or runs files."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile

APP = "apps/admin-web"
API = ["apps/api/src/reports/reports.admin.ts", "apps/api/src/reports/reports.admin-types.ts"]
SOURCE_PATHS = [APP, *API]
CANONICAL_NEXT_ENV = (b'/// <reference types="next" />\n'
    b'/// <reference types="next/image-types/global" />\n'
    b'import "./.next/types/routes.d.ts";\n'
    b'import "./.next/types/root-params.d.ts";\n\n'
    b'// NOTE: This file should not be edited\n'
    b'// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.\n')
EXCLUDED = {".git", ".cache", ".npm", ".npm-cache", ".build-tools", "__pycache__",
    "coverage", "test-results", "test-reports", "playwright-report", ".openai", ".wrangler"}
CONFIG_FIELDS = {"NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_CLIENT_MODE", "NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT", "NEXT_PUBLIC_ENABLE_MOCKS"}

class VerificationError(RuntimeError): pass

def require(condition, code):
    if not condition: raise VerificationError(code)

def sha(body): return hashlib.sha256(body).hexdigest()

def file_sha(path):
    digest=hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b""): digest.update(chunk)
    return digest.hexdigest()

def omitted(name):
    parts=PurePosixPath(name).parts
    return (any(p.startswith(".env") or p.endswith(".env") or p in EXCLUDED for p in parts)
        or any(parts[i:i+2]==(".next","cache") for i in range(len(parts)-1))
        or name.endswith((".log", ".tsbuildinfo")))

def canonical_path(name):
    return (isinstance(name,str) and bool(name) and "\\" not in name
        and not any(ord(char)<32 or ord(char)==127 for char in name)
        and ":" not in name and not name.startswith("/") and ".." not in name.split("/")
        and PurePosixPath(name).as_posix()==name)

def validate_runtime_members(members):
    indexed={}
    symlinks={}
    for member in members:
        name=member.name
        require(canonical_path(name), "UNSAFE_MEMBER_PATH")
        require(name==APP or name.startswith(APP+"/") or name in API, "ARCHIVE_SCOPE_MISMATCH")
        require(not omitted(name), "EXCLUDED_OR_ENVIRONMENT_MEMBER")
        require(name not in indexed, "DUPLICATE_MEMBER")
        require(member.isfile() or member.isdir() or member.issym(), "UNSUPPORTED_MEMBER_TYPE")
        require(not getattr(member,"sparse",None), "SPARSE_MEMBER_FORBIDDEN")
        if name==APP: require(member.isdir(), "APP_ROOT_NOT_DIRECTORY")
        if name in API: require(member.isfile(), "REPORT_SOURCE_NOT_REGULAR")
        indexed[name]=member
        if member.issym(): symlinks[name]=member.linkname
    for name in indexed:
        for parent in PurePosixPath(name).parents:
            existing=indexed.get(str(parent))
            require(existing is None or existing.isdir(), "NON_DIRECTORY_MEMBER_ANCESTOR")
    for name,target in symlinks.items():
        require(isinstance(target,str) and target and not target.startswith("/")
            and "\\" not in target and ":" not in target
            and not any(ord(char)<32 or ord(char)==127 for char in target),
            "UNSAFE_SYMLINK_TARGET")
        parts=list(PurePosixPath(name).parent.parts)
        for part in target.split("/"):
            if part in ("", "."): continue
            if part=="..":
                require(bool(parts), "SYMLINK_ESCAPE")
                parts.pop()
            else: parts.append(part)
            require(parts[:2]==["apps","admin-web"], "SYMLINK_ESCAPE")
            require("/".join(parts) not in symlinks, "SYMLINK_TARGET_CHAIN")
        resolved="/".join(parts)
        require(canonical_path(resolved) and resolved.startswith(APP+"/") and not omitted(resolved), "UNSAFE_SYMLINK_TARGET")
        require(resolved in indexed, "DANGLING_SYMLINK")
    return indexed

def git(root,*args):
    # Reproduce the Linux CI archive independently of a Windows autocrlf setting.
    result=subprocess.run(["git","-c","safe.directory="+str(Path(root).resolve()),
        "-c","core.autocrlf=false","-c","core.eol=lf",*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    require(result.returncode==0, "GIT_OBJECT_OR_COMMAND_UNAVAILABLE")
    return result.stdout

def committed_sources(root,commit):
    archive=git(root,"archive","--format=tar",commit,*SOURCE_PATHS)
    sources={}; excluded=0
    with tarfile.open(fileobj=io.BytesIO(archive),mode="r:") as bundle:
        for member in bundle:
            if member.isdir(): continue
            if omitted(member.name): excluded+=1; continue
            require(member.isfile() or member.issym(), "UNSUPPORTED_GIT_SOURCE_TYPE")
            body=bundle.extractfile(member).read() if member.isfile() else member.linkname.encode()
            sources[member.name]={"sha256":sha(body),"symlink":member.issym(),"target":member.linkname}
    return sha(archive),sources,excluded

def verify_candidate(root,archive,manifest_path,pins):
    root,archive,manifest_path=Path(root),Path(archive),Path(manifest_path)
    for key in ["sourceCommit","compatibleCommit"]:
        require(isinstance(pins.get(key),str) and re.fullmatch("[a-f0-9]{40}",pins[key]), "COMMIT_PIN_INVALID")
        require(git(root,"rev-parse",pins[key]+"^{commit}").decode().strip()==pins[key], "COMMIT_PIN_MISMATCH")
    archive_hash=file_sha(archive)
    require(archive_hash==pins["archiveSha256"] and archive.stat().st_size==pins["archiveBytes"], "ARCHIVE_PIN_MISMATCH")
    require(file_sha(manifest_path)==pins["manifestSha256"], "MANIFEST_PIN_MISMATCH")
    try: manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    except (ValueError,UnicodeError): raise VerificationError("MANIFEST_INVALID") from None
    expected_fields={"sourceSha","adminGitTree","sourceArchiveSha256","sourceArchivePaths","lockSha256","node","npm","buildId","publicConfigurationSha256","runtimeSecretsIncluded"}
    require(isinstance(manifest,dict) and set(manifest)==expected_fields, "MANIFEST_SCHEMA_MISMATCH")
    tree=git(root,"rev-parse",pins["sourceCommit"]+":"+APP).decode().strip()
    require(tree==pins["adminGitTree"]==manifest["adminGitTree"], "ADMIN_TREE_PIN_MISMATCH")
    require(git(root,"rev-parse",pins["compatibleCommit"]+":"+APP).decode().strip()==tree, "COMPATIBLE_ADMIN_TREE_MISMATCH")
    require(not git(root,"diff","--name-only",pins["sourceCommit"],pins["compatibleCommit"],"--",*SOURCE_PATHS).strip(), "COMPATIBLE_REPORT_OR_SOURCE_DRIFT")
    for field,pin in [("sourceSha","sourceCommit"),("buildId","buildId"),("lockSha256","lockSha256"),("sourceArchiveSha256","sourceArchiveSha256")]:
        require(manifest[field]==pins[pin], "MANIFEST_IDENTITY_MISMATCH_"+field)
    require(manifest["sourceArchivePaths"]==SOURCE_PATHS and manifest["node"]=="v24.16.0"
        and manifest["npm"]=="11.17.0" and manifest["runtimeSecretsIncluded"] is False,
        "MANIFEST_TOOLCHAIN_OR_SCOPE_MISMATCH")
    config=manifest["publicConfigurationSha256"]
    require(isinstance(config,dict) and set(config)==CONFIG_FIELDS and all(isinstance(v,str) and re.fullmatch("[a-f0-9]{64}",v) for v in config.values()), "PUBLIC_CONFIGURATION_DIGEST_SCHEMA_INVALID")
    source_hash,sources,excluded=committed_sources(root,pins["sourceCommit"])
    require(source_hash==manifest["sourceArchiveSha256"], "GIT_SOURCE_ARCHIVE_PIN_MISMATCH")
    lock_path=APP+"/package-lock.json"
    require(sources[lock_path]["sha256"]==pins["lockSha256"], "GIT_LOCK_PIN_MISMATCH")
    required={APP+"/.next/BUILD_ID",APP+"/.next/required-server-files.json",APP+"/node_modules/next/package.json",
        APP+"/package.json",lock_path,APP+"/next.config.ts",APP+"/tsconfig.json",APP+"/next-env.d.ts",
        APP+"/src/core/config/runtime.ts",APP+"/src/core/config/server-runtime.ts",*API}
    capture={APP+"/.next/BUILD_ID",APP+"/.next/required-server-files.json",APP+"/node_modules/next/package.json",lock_path,APP+"/package.json",APP+"/next-env.d.ts"}
    members=[]; present=set(); bodies={}; static=[]; rewrites=[]
    with tarfile.open(archive,"r|gz") as bundle:
        for member in bundle:
            members.append(member); name=member.name
            require(canonical_path(name), "UNSAFE_MEMBER_PATH")
            if member.isdir(): continue
            known=sources.get(name)
            generated=name.startswith(APP+"/.next/") or name.startswith(APP+"/node_modules/")
            require(known is not None or generated, "UNTRACKED_SHIPPED_SOURCE")
            if known and known["symlink"]:
                require(member.issym() and member.linkname==known["target"], "SOURCE_SYMLINK_MISMATCH")
                present.add(name); continue
            if known: require(member.isfile(), "SOURCE_TYPE_MISMATCH")
            if not member.isfile(): continue
            wanted=known is not None or name in capture or name.startswith(APP+"/.next/static/")
            if not wanted: continue
            keep=name in capture
            require(not keep or member.size<=5*1024*1024, "METADATA_TOO_LARGE")
            digest=hashlib.sha256(); chunks=[]
            stream=bundle.extractfile(member)
            for chunk in iter(lambda:stream.read(1024*1024),b""):
                digest.update(chunk)
                if keep: chunks.append(chunk)
            actual=digest.hexdigest()
            if keep: bodies[name]=b"".join(chunks)
            if known:
                if actual!=known["sha256"]:
                    require(name==APP+"/next-env.d.ts" and bodies.get(name)==CANONICAL_NEXT_ENV, "SHIPPED_SOURCE_MISMATCH")
                    rewrites.append(name)
                present.add(name)
            if name.startswith(APP+"/.next/static/"):
                static.append({"path":name,"sha256":actual,"bytes":member.size})
    indexed=validate_runtime_members(members)
    require(set(sources)<=present, "SHIPPED_SOURCE_MISSING")
    require(required<=set(indexed) and all(indexed[p].isfile() for p in required), "REQUIRED_RUNTIME_FILE_MISSING")
    require(bodies[APP+"/.next/BUILD_ID"].decode().strip()==pins["buildId"], "RUNTIME_BUILD_ID_MISMATCH")
    try:
        lock=json.loads(bodies[lock_path]); package=json.loads(bodies[APP+"/package.json"])
        next_package=json.loads(bodies[APP+"/node_modules/next/package.json"])
        required_server=json.loads(bodies[APP+"/.next/required-server-files.json"])
    except (ValueError,UnicodeError): raise VerificationError("RUNTIME_METADATA_INVALID") from None
    require(next_package["version"]==lock["packages"]["node_modules/next"]["version"]==package["dependencies"]["next"], "NEXT_VERSION_MISMATCH")
    require(isinstance(required_server.get("files"),list) and required_server["files"], "REQUIRED_SERVER_FILES_INVALID")
    for item in required_server["files"]:
        require(canonical_path(item) and not omitted(item) and APP+"/"+item in indexed and indexed[APP+"/"+item].isfile(), "DECLARED_RUNTIME_FILE_MISSING_OR_UNSAFE")
    static.sort(key=lambda item:item["path"])
    require(bool(static), "STATIC_ARTIFACT_MISSING")
    preferred=next((item for item in static if item["path"].endswith(".css")),static[0])
    report={"verified":True,"sourceCommit":pins["sourceCommit"],"compatibleCommit":pins["compatibleCommit"],
        "adminGitTree":tree,"compatibleSourcesVerified":True,"sourceArchiveSha256":source_hash,
        "sourceFilesVerified":len(sources),"excludedTrackedFiles":excluded,"generatedNextEnvRewrites":rewrites,
        "apiReportSources":{name:sources[name]["sha256"] for name in API},
        "runtimeArchive":{"path":str(archive.resolve()),"sha256":archive_hash,"bytes":archive.stat().st_size},
        "manifest":{"path":str(manifest_path.resolve()),"sha256":pins["manifestSha256"]},
        "lockSha256":pins["lockSha256"],"buildId":pins["buildId"],"node":manifest["node"],"npm":manifest["npm"],
        "memberCount":len(members),"symlinkCount":sum(m.issym() for m in members),"staticArtifactCount":len(static),
        "staticArtifact":preferred,"noEnvironmentOrExcludedMembers":True,"noUnsafeLinksOrDuplicateMembers":True,
        "extractedToDisk":False,"artifactExecuted":False,"artifactBuilt":False,"hostedActions":False,
        "limits":["Generated runtime/dependency contents are bound by the independently pinned archive; no reproducible rebuild was performed.",
                  "This validates archive scope and source identity, not authenticated hosted behavior or a full secret-content scan."]}
    return report,static

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ["root","archive","manifest","pins","report","static-inventory"]: parser.add_argument("--"+name,type=Path,required=True)
    args=parser.parse_args()
    inputs={path.resolve() for path in [args.archive,args.manifest,args.pins]}
    outputs={args.report.resolve(),args.static_inventory.resolve()}
    if len(outputs)!=2 or inputs & outputs:
        parser.error("OUTPUT_PATH_COLLIDES_WITH_INPUT")
    try:
        pins=json.loads(args.pins.read_text(encoding="utf-8"))
        report,static=verify_candidate(args.root,args.archive,args.manifest,pins)
        static_bytes=(json.dumps(static,indent=2)+"\n").encode()
        args.static_inventory.write_bytes(static_bytes)
        report["staticInventory"]={"path":str(args.static_inventory.resolve()),"sha256":sha(static_bytes)}
        args.report.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"verified":True,"sourceFilesVerified":report["sourceFilesVerified"],"memberCount":report["memberCount"],"reportPath":str(args.report.resolve())}))
    except (VerificationError,OSError,ValueError,KeyError,tarfile.TarError) as error:
        code=str(error) if isinstance(error,VerificationError) else type(error).__name__
        try: args.report.write_text(json.dumps({"verified":False,"error":code})+"\n",encoding="utf-8")
        except OSError: pass  # The nonzero exit remains authoritative if output is unwritable.
        print("Candidate verification failed: "+code,file=sys.stderr)
        return 1
    return 0

if __name__=="__main__": sys.exit(main())
