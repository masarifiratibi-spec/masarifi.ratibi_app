"""Offline, hash-bound patching. This module does not contact Docker or a database."""
import hashlib
import re


def sha(value):
    return hashlib.sha256(value).hexdigest()


def normalize(value):
    if b'\r' in value.replace(b'\r\n', b''):
        raise ValueError('BARE_CR')
    return value.replace(b'\r\n', b'\n')


def apply_exact_patch(original, patch, pins, filename):
    if sha(original) != pins["beforeSha256"] or sha(normalize(original)) != pins["normalizedBeforeSha256"]:
        raise ValueError('PREIMAGE_DRIFT')
    if sha(patch) != pins["patchSha256"]:
        raise ValueError('PATCH_DRIFT')
    lines = patch.splitlines(keepends=True)
    if lines[:2] != [f'--- a/{filename}\n'.encode(), f'+++ b/{filename}\n'.encode()]:
        raise ValueError('PATCH_HEADERS')
    raw = original.splitlines(keepends=True)
    output = []
    cursor, index, hunks = 0, 2, 0
    while index < len(lines):
        match = re.fullmatch(rb'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@[^\n]*\n', lines[index])
        if not match:
            raise ValueError('HUNK_HEADER')
        start = int(match[1]) - 1
        old_count, new_count = int(match[2] or b'1'), int(match[4] or b'1')
        if start < cursor or start > len(raw):
            raise ValueError('HUNK_POSITION')
        output.extend(raw[cursor:start])
        cursor, index = start, index + 1
        old_seen = new_seen = 0
        while index < len(lines) and not lines[index].startswith(b'@@ '):
            line = lines[index]
            marker, content = line[:1], line[1:]
            if marker not in (b' ', b'-', b'+') or not content.endswith(b'\n'):
                raise ValueError('HUNK_LINE')
            if marker in (b' ', b'-'):
                if cursor >= len(raw) or normalize(raw[cursor]) != content:
                    raise ValueError('HUNK_CONTEXT')
                old_seen += 1
                if marker == b' ':
                    output.append(raw[cursor])  # Preserve every untouched byte, including CRLF.
                    new_seen += 1
                cursor += 1
            else:
                output.append(content)
                new_seen += 1
            index += 1
        if (old_seen, new_seen) != (old_count, new_count):
            raise ValueError('HUNK_COUNTS')
        hunks += 1
    output.extend(raw[cursor:])
    result = b''.join(output)
    if not hunks or sha(normalize(result)) != pins["normalizedAfterSha256"]:
        raise ValueError('POSTIMAGE_DRIFT')
    return result
