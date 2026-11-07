"""Read-only receipt from on-disk Nginx configuration. No subprocess, network or write."""
import sys
sys.dont_write_bytecode = True       # Also when loaded from a reviewed local module.
import fnmatch
import glob
import json
import os
from hashlib import sha256
from pathlib import Path
import re
import stat

import nginx_delta as ng


MAIN = Path("/etc/nginx/nginx.conf")
STAGING = "masarifi-staging"
PRIMARY = "masarifi-production-core-20261105.conf"
TLS_SNIPPET = Path("/etc/letsencrypt/options-ssl-nginx.conf")


def digest(data):
    return sha256(data).hexdigest()


class Inputs:
    """Hold in-memory content and expansion order; recheck before releasing the receipt."""

    def __init__(self, main, tls_snippet, modules):
        self.prefix = main.parent
        self.tls_snippet = tls_snippet
        self.modules = modules
        self.files = {}
        self.patterns = {}
        self.total_bytes = 0
        self.include_visits = 0

    def file(self, path):
        if path not in self.files:
            target = path.resolve(strict=True)
            ng.require(target.is_relative_to(self.prefix) or target == self.tls_snippet
                       or target.is_relative_to(self.modules), "UNREVIEWED_CONFIG_INPUT")
            info = target.stat()
            ng.require(stat.S_ISREG(info.st_mode) and info.st_size <= 4 * 1024 * 1024
                       and self.total_bytes + info.st_size <= 32 * 1024 * 1024 and len(self.files) < 512,
                       "UNSUPPORTED_CONFIG_INPUT")
            content = path.read_bytes()
            ng.require(len(content) == info.st_size, "CONTEXT_CHANGED_DURING_READ")
            self.total_bytes += len(content)
            self.files[path] = (target, content)
        return self.files[path][1]

    def matches(self, word):
        ng.require(b"$" not in word and b"\0" not in word and b"\\" not in word, "UNSUPPORTED_INCLUDE_PATTERN")
        pattern = Path(os.fsdecode(word))
        if not pattern.is_absolute():
            pattern = self.prefix / pattern     # Nginx conf_prefix, not directory of the including snippet.
        ng.require(".." not in pattern.parts and (pattern.is_relative_to(self.prefix)
                   or pattern == self.tls_snippet or pattern.is_relative_to(self.modules)), "UNREVIEWED_INCLUDE_PATTERN")
        if glob.has_magic(str(pattern)):
            directory = pattern.parent.resolve(strict=True)
            ng.require(directory.is_relative_to(self.prefix) or directory.is_relative_to(self.modules), "UNREVIEWED_INCLUDE_DIRECTORY")
        if pattern not in self.patterns:
            self.patterns[pattern] = self.expand_pattern(pattern)
            ng.require(len(self.patterns) <= 512, "INCLUDE_GRAPH_TOO_LARGE")
        return self.patterns[pattern]

    @staticmethod
    def expand_pattern(pattern):
        if not glob.has_magic(str(pattern)):
            return (pattern,)
        # Require an enumerable directory and a basename-only glob. Missing literal
        # inputs fail at read time. An empty *.conf is an ordinary Nginx case.
        ng.require(not glob.has_magic(str(pattern.parent)), "UNSUPPORTED_INCLUDE_DIRECTORY_GLOB")
        with os.scandir(pattern.parent) as entries:
            names = [e.name for e in entries]
        # Match the glob(3) exclusion of dotfiles.
        result = (pattern.parent / name for name in names
                  if (not name.startswith(".") or pattern.name.startswith("."))
                  and fnmatch.fnmatchcase(name, pattern.name))
        return tuple(sorted(result, key=os.fsencode))

    def scope(self, nodes, source, chain, memberships=None):
        for node in nodes:
            if node.words[0] != b"include":
                yield node, source
                continue
            ng.require(len(node.words) == 2 and node.body is None, "INVALID_INCLUDE")
            for path in self.matches(node.words[1]):
                self.include_visits += 1
                ng.require(self.include_visits <= 2048, "INCLUDE_GRAPH_TOO_LARGE")
                original = self.file(path)
                real = self.files[path][0]
                ng.require(real not in chain and len(chain) < 32, "RECURSIVE_INCLUDE")
                if memberships is not None:
                    memberships.append(path)
                yield from self.scope(ng.parse(original), path, chain + (real,), memberships)

    def stable(self):
        for pattern, matches in self.patterns.items():
            ng.require(self.expand_pattern(pattern) == matches, "INCLUDE_MEMBERSHIP_CHANGED")
        for path, (target, content) in self.files.items():
            ng.require(path.resolve(strict=True) == target and path.read_bytes() == content, "CONTEXT_CHANGED_DURING_READ")

    def inventory(self):
        # Paths in arbitrary snippets can carry private identifiers. Preserve provenance
        # with hashes rather than posting raw paths, header values, config or directives.
        return {
            "files": [{"inputPathSha256": digest(os.fsencode(p)), "resolvedPathSha256": digest(os.fsencode(real)),
                       "contentSha256": digest(data)} for p, (real, data) in sorted(self.files.items())],
            "includes": [{"patternSha256": digest(os.fsencode(pattern)),
                          "orderedPathsSha256": [digest(os.fsencode(p)) for p in paths]}
                         for pattern, paths in sorted(self.patterns.items())],
        }


def check_header_context(node):
    key = node.words[0]
    forbidden = (b"rewrite", b"return", b"try_files", b"error_page", b"add_header_inherit", b"more_set_headers",
                 b"more_clear_headers", b"js_header_filter", b"js_body_filter", b"js_content")
    ng.require(key not in forbidden and b"_by_lua" not in key, "UNREVIEWED_ROUTING_OR_HEADER_FILTER")
    if key == b"if":
        for child in node.children:
            check_header_context(child)
    if key in (b"add_header", b"proxy_pass_header") and len(node.words) >= 2:
        ng.require(node.words[1].lower() != b"cache-control", "CONFLICTING_GLOBAL_CACHE_CONTROL")


def pinned_links(prefix, staging_hash, primary_hash):
    staging = prefix / "sites-available" / STAGING
    primary = prefix / "sites-available" / PRIMARY
    enabled = prefix / "sites-enabled"
    stage_link = enabled / STAGING
    # Both the enabled basename and target are pinned by the host receipt.
    primary_link = enabled / PRIMARY
    links = [p for p in enabled.iterdir() if p.is_symlink() and p.resolve(strict=True) == primary]
    ng.require(links == [primary_link], "PRIMARY_ENABLED_LINK_DRIFT")
    raw = ng.read_pinned_paths(staging, stage_link, primary, primary_link, staging_sha=staging_hash, primary_sha=primary_hash)
    return raw, ((stage_link, staging), (primary_link, primary))


def receipt(*, main=MAIN, tls_snippet=TLS_SNIPPET, modules=Path("/usr/share/nginx/modules-available"),
            staging_hash=ng.BASE_SHA256, primary_hash=ng.PRIMARY_SHA256):
    ng.require(main.is_absolute() and main.resolve(strict=True) == main, "MAIN_CONFIG_PATH_DRIFT")
    staging, bindings = pinned_links(main.parent, staging_hash, primary_hash)
    inputs = Inputs(main, tls_snippet, modules)
    content = inputs.file(main)
    top = inputs.scope(ng.parse(content), main, (main,))
    http, source = ng.one([(n, p) for n, p in top if n.words == (b"http",) and n.body is not None], "AMBIGUOUS_HTTP_CONTEXT")
    memberships = []
    http_nodes = list(inputs.scope(http.children, source, (source.resolve(strict=True),), memberships))
    for link, target in bindings:
        ng.require([p for p in memberships if inputs.files[p][0] == target] == [link], "PINNED_SITE_NOT_ENABLED_EXACTLY_ONCE")
    ng.require(inputs.file(bindings[0][0]) == staging and digest(inputs.file(bindings[1][0])) == primary_hash,
               "ENABLED_CONTENT_DRIFT")
    http_headers = []
    for node, origin in http_nodes:
        if node.words[0] == b"server":
            if origin != bindings[0][0]:
                entries = inputs.scope(node.children, origin, (origin.resolve(strict=True),))
                for entry, _ in entries:
                    if entry.words[0] == b"server_name":
                        ng.require(not any(name.lower() in (ng.API_HOST, ng.ADMIN_HOST) for name in entry.words[1:]),
                                   "TARGET_HOST_IN_ANOTHER_SITE")
            continue   # A server's descendants are not inherited HTTP directives.
        check_header_context(node)
        ng.check_inherited_upstream_header(node)
        if node.words[0] == b"add_header":
            http_headers.append(inputs.file(origin)[node.start:node.end])

    stage_nodes = ng.parse(staging)
    server_includes = {}
    api = ng.server_for(stage_nodes, ng.API_HOST)
    for server in (api, ng.server_for(stage_nodes, ng.ADMIN_HOST)):
        for inc in ng.named(server.children, b"include"):
            ng.require(len(inc.words) == 2 and not glob.has_magic(os.fsdecode(inc.words[1])), "UNREVIEWED_TARGET_SERVER_INCLUDE")
            path = ng.one(inputs.matches(inc.words[1]), "UNRESOLVED_TARGET_SERVER_INCLUDE")
            server_includes[inc.words[1]] = inputs.file(path)
    for node, _ in ng.expand_server(api.children, staging, server_includes):
        check_header_context(node)
    api_root, _ = ng.root_location(api, ng.API_OLD)
    for node in api_root.children:
        # A local Cache-Control is purposefully replaced by no-store. Inherited
        # server/http conflicts are rejected above rather than silently superseded.
        if node.words[0] == b"add_header" and node.words[1].lower() == b"cache-control":
            continue
        check_header_context(node)
    kwargs = dict(expected_sha=staging_hash, includes=server_includes, http_add_headers=http_headers)
    proposed = ng.candidate(staging, **kwargs)
    result_hash = ng.verify_candidate(staging, proposed, **kwargs)
    patched = ng.parse(proposed)
    patched_api = ng.server_for(patched, ng.API_HOST)
    locations = []
    for node in ng.named(patched_api.children, b"location"):
        if len(node.words) != 3 or node.words[2].rstrip(b"/") not in ng.API_PATHS:
            continue
        proxy = ng.one(ng.named(node.children, b"proxy_pass"), "PATCHED_PROXY_COUNT")
        ng.require(proxy.words == (b"proxy_pass", ng.API_NEW), "PATCHED_PROXY_DRIFT")
        locations.append({"modifier": node.words[1].decode(), "uri": node.words[2].decode(),
                          "upstream": ng.API_NEW.decode(), "cacheControl": "no-store"})
    ng.require(len(locations) == 4, "PATCHED_LOCATION_COUNT")
    ng.root_location(ng.server_for(patched, ng.ADMIN_HOST), ng.ADMIN_NEW)
    inputs.stable()
    unchanged, final_bindings = pinned_links(main.parent, staging_hash, primary_hash)
    ng.require(staging == unchanged and final_bindings == bindings, "ROUTING_LINK_CHANGED_DURING_READ")
    inventory = inputs.inventory()
    return {
        "stagingAvailableSha256": staging_hash, "protectedPrimarySha256": primary_hash, "candidateSha256": result_hash,
        "contextSha256": digest(json.dumps(inventory, sort_keys=True, separators=(",", ":")).encode()),
        "context": inventory, "httpAddHeaderCount": len(http_headers),
        "diff": {"apiHost": ng.API_HOST.decode(), "addedLocations": locations, "defaultApiRetained": ng.API_OLD.decode(),
                 "adminHost": ng.ADMIN_HOST.decode(), "changedAdminUpstream": [ng.ADMIN_OLD.decode(), ng.ADMIN_NEW.decode()]},
        "readOnly": True,
    }


def main():
    try:
        print(json.dumps(receipt(), sort_keys=True, separators=(",", ":")))
    except ng.RoutingDrift as error:
        # Every RoutingDrift uses a fixed reason from the reviewed source.
        safe = str(error) if re.fullmatch(r"[A-Z0-9_]+", str(error)) else "INVALID_CONFIG"
        print(json.dumps({"readOnly": True, "error": safe}))
        return 1
    except (OSError, ValueError, IndexError, RuntimeError):
        print(json.dumps({"readOnly": True, "error": "CONFIG_CONTEXT_UNREADABLE"}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
