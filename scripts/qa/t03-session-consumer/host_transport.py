"""Public-data-only, exclusive upload and separately invoked extraction.

The invocation must hash the decoded program before executing it. No database,
credentials, Docker, shell archive evaluation, removal or overwrite exists here.
"""
import argparse
import base64
import hashlib
import io
import gzip
import json
import os
import re
import stat
import sys
import tarfile

ROOT = '/opt/masarifi/qa-t03'
MAX_ARCHIVE = 10485760
MAX_EXPANDED = 33554432
MAX_FILE = 4194304


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def directory(path):
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        for part in path.strip('/').split('/'):
            require(part not in ('', '.', '..'), 'QA_UPLOAD_PATH')
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            os.close(fd)
            fd = child
            value = os.fstat(fd)
            require(value.st_uid in (0, 1000) and not value.st_mode & 0o002, 'QA_UPLOAD_DIRECTORY_IDENTITY')
        return fd
    except BaseException:
        os.close(fd)
        raise


def mkdir(path, mode):
    parent = directory(os.path.dirname(path))
    try:
        os.mkdir(os.path.basename(path), mode, dir_fd=parent)
        child = os.open(os.path.basename(path), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            os.fchown(child, 0, 0)
            os.fchmod(child, mode)
            os.fsync(child)
        finally:
            os.close(child)
        os.fsync(parent)
    finally:
        os.close(parent)


def write(path, data, mode=0o400):
    parent = directory(os.path.dirname(path))
    try:
        fd = os.open(os.path.basename(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, mode, dir_fd=parent)
        try:
            os.fchown(fd, 0, 0)
            os.fchmod(fd, mode)
            view = memoryview(data)
            while view:
                count = os.write(fd, view)
                require(count > 0, 'QA_UPLOAD_WRITE')
                view = view[count:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(parent)
    finally:
        os.close(parent)


def read(path, limit):
    parent = directory(os.path.dirname(path))
    try:
        fd = os.open(os.path.basename(path), os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
    finally:
        os.close(parent)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == 0 and not stat.S_IMODE(before.st_mode) & 0o222 and 0 < before.st_size <= limit, 'QA_UPLOAD_FILE_IDENTITY')
        result = bytearray()
        while len(result) <= limit:
            value = os.read(fd, min(65536, limit+1-len(result)))
            if not value:
                break
            result.extend(value)
        after = os.fstat(fd)
        require(len(result) == before.st_size and (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'QA_UPLOAD_CHANGED')
        return bytes(result)
    finally:
        os.close(fd)


def validate_members(members):
    require(0 < len(members) <= 1000, 'QA_ARCHIVE_MEMBER_COUNT')
    names = set()
    total = 0
    for item in members:
        name = item.name
        require(item.isfile() and re.fullmatch(r'[A-Za-z0-9@._/-]+', name) and not name.startswith('/') and all(part not in ('', '.', '..') for part in name.split('/')) and name not in names and 0 <= item.size <= MAX_FILE, 'QA_ARCHIVE_MEMBER')
        names.add(name)
        total += item.size
    require(total <= MAX_EXPANDED, 'QA_ARCHIVE_EXPANDED_LIMIT')
    return names


def install(bucket, archive_pin, package_pin, size):
    raw = read(bucket+'/artifact.tar.gz', MAX_ARCHIVE)
    require(len(raw) == size and sha(raw) == archive_pin, 'QA_ARCHIVE_PIN')
    with gzip.GzipFile(fileobj=io.BytesIO(raw), mode='rb') as compressed:
        expanded = compressed.read(MAX_EXPANDED+1048576+1)
        require(len(expanded) <= MAX_EXPANDED+1048576 and not compressed.read(1), 'QA_ARCHIVE_EXPANSION_LIMIT')
    with tarfile.open(fileobj=io.BytesIO(expanded), mode='r:') as archive:
        members = archive.getmembers()
        names = validate_members(members)
        manifest_member = next(item for item in members if item.name == 'package-manifest.json')
        manifest_bytes = archive.extractfile(manifest_member).read(MAX_FILE+1)
        require(sha(manifest_bytes) == package_pin, 'QA_ARCHIVE_PACKAGE_PIN')
        manifest = json.loads(manifest_bytes)
        expected = {entry['path']: entry for entry in manifest['files']}
        require(len(expected) == len(manifest['files']) and names == set(expected)|{'package-manifest.json'}, 'QA_ARCHIVE_FILE_SET')
        for item in members:
            data = archive.extractfile(item).read(MAX_FILE+1)
            entry = expected.get(item.name)
            require(len(data) == item.size and (item.name == 'package-manifest.json' or (len(data) == entry['bytes'] and sha(data) == entry['sha256'])), 'QA_ARCHIVE_FILE_PIN')
        target = ROOT+'/packages/'+archive_pin
        mkdir(target, 0o700)
        made = {target}
        for item in sorted(members, key=lambda item: item.name):
            parent = target
            for part in item.name.split('/')[:-1]:
                parent += '/'+part
                if parent not in made:
                    mkdir(parent, 0o700)
                    made.add(parent)
            write(target+'/'+item.name, archive.extractfile(item).read(MAX_FILE+1), 0o444)
        for folder in sorted(made, key=len, reverse=True):
            fd = directory(folder)
            try:
                os.fchmod(fd, 0o555)
                os.fsync(fd)
            finally:
                os.close(fd)
        write(bucket+'/installation.json', json.dumps({'archiveSha256': archive_pin, 'packageSha256': package_pin, 'files': len(names), 'root': target}, separators=(',', ':')).encode())
        return {'ok': True, 'stage': 'installed-public-only', 'files': len(names), 'archiveSha256': archive_pin, 'packageSha256': package_pin}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('stage', choices=['init', 'chunk', 'finalize', 'install'])
    parser.add_argument('--archive-sha256', required=True)
    parser.add_argument('--package-sha256', required=True)
    parser.add_argument('--program-sha256', required=True)
    parser.add_argument('--archive-bytes', required=True, type=int)
    parser.add_argument('--parts', required=True, type=int)
    parser.add_argument('--sequence', type=int)
    parser.add_argument('--part-sha256')
    parser.add_argument('--data')
    args = parser.parse_args()
    require(sys.platform == 'linux' and os.geteuid() == 0, 'QA_UPLOAD_PLATFORM')
    require(all(re.fullmatch(r'[a-f0-9]{64}', pin) for pin in (args.archive_sha256, args.package_sha256, args.program_sha256)) and 0 < args.archive_bytes <= MAX_ARCHIVE and 0 < args.parts <= 500, 'QA_UPLOAD_ARGUMENTS')
    source = globals().get('__reviewed_source__')
    require(isinstance(source, bytes) and sha(source) == args.program_sha256, 'QA_UPLOAD_PROGRAM_PIN')
    bucket = ROOT+'/uploads/'+args.archive_sha256
    intent = {'archiveSha256': args.archive_sha256, 'packageSha256': args.package_sha256, 'programSha256': args.program_sha256, 'archiveBytes': args.archive_bytes, 'parts': args.parts}
    if args.stage == 'init':
        if not os.path.lexists(ROOT):
            mkdir(ROOT, 0o755)
            write(ROOT+'/transport-ownership.json', b'{"scope":"public-t03-artifact-v1"}', 0o444)
            mkdir(ROOT+'/uploads', 0o700)
            mkdir(ROOT+'/packages', 0o755)
        require(read(ROOT+'/transport-ownership.json', 1024) == b'{"scope":"public-t03-artifact-v1"}', 'QA_UPLOAD_ROOT_OWNERSHIP')
        mkdir(bucket, 0o700)
        write(bucket+'/intent.json', json.dumps(intent, separators=(',', ':')).encode())
        write(bucket+'/program.py', source, 0o444)
        return {'ok': True, 'stage': 'initialized', 'archiveSha256': args.archive_sha256, 'parts': args.parts}
    require(json.loads(read(bucket+'/intent.json', 4096)) == intent and read(bucket+'/program.py', 65536) == source, 'QA_UPLOAD_INTENT')
    if args.stage == 'chunk':
        require(args.sequence is not None and 0 <= args.sequence < args.parts and args.data and len(args.data) <= 32768 and re.fullmatch(r'[a-f0-9]{64}', args.part_sha256 or ''), 'QA_UPLOAD_CHUNK_ARGUMENTS')
        fd = directory(bucket)
        try:
            existing = sorted(name for name in os.listdir(fd) if re.fullmatch(r'chunk-[0-9]{4}\.bin', name))
        finally:
            os.close(fd)
        require(existing == [f'chunk-{i:04d}.bin' for i in range(args.sequence)], 'QA_UPLOAD_CHUNK_SEQUENCE')
        data = base64.b64decode(args.data, validate=True)
        require(sha(data) == args.part_sha256, 'QA_UPLOAD_CHUNK_PIN')
        write(bucket+f'/chunk-{args.sequence:04d}.bin', data)
        return {'ok': True, 'stage': 'chunk', 'sequence': args.sequence, 'sha256': sha(data), 'bytes': len(data)}
    if args.stage == 'finalize':
        data = b''.join(read(bucket+f'/chunk-{i:04d}.bin', 24576) for i in range(args.parts))
        require(len(data) == args.archive_bytes and sha(data) == args.archive_sha256, 'QA_UPLOAD_ARCHIVE_PIN')
        write(bucket+'/artifact.tar.gz', data)
        return {'ok': True, 'stage': 'uploaded-only', 'sha256': sha(data), 'bytes': len(data), 'parts': args.parts}
    return install(bucket, args.archive_sha256, args.package_sha256, args.archive_bytes)


if __name__ == '__main__':
    try:
        print(json.dumps(main(), separators=(',', ':')))
    except BaseException:
        print('{"ok":false,"code":"QA_PUBLIC_TRANSPORT_STOPPED"}')
        sys.exit(1)
