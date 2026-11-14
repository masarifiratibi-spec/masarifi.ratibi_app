"""Calculate and check the support-access proxy delta. No installation or reload."""
from dataclasses import dataclass
from hashlib import sha256
import os
from pathlib import Path
import re


BASE_SHA256 = "81c6ca948a8264214b1c64fa1d72c06079403814064bda62311143691466c9b9"
API_HOST = b"api.staging.masarifiratibi.com"
ADMIN_HOST = b"staging.masarifiratibi.com"
API_PATHS = (b"/api/v1/admin/support-access/requests", b"/api/v1/me/support-access/requests")
API_OLD = b"http://127.0.0.1:3001"
API_NEW = b"http://127.0.0.1:3091"
ADMIN_OLD = b"http://127.0.0.1:3041"
ADMIN_NEW = b"http://127.0.0.1:3090"
RECOVERY_INCLUDE = b"/etc/nginx/snippets/masarifi-admin-recovery-7e3bbef0.conf"
RECOVERY_SHA256 = "b25cb5dcd49ab396ea621fa249c474c0c09f173939e50dd93159c4dc428c85ba"
RECOVERY_UPSTREAM = b"http://127.0.0.1:3033"
ADMIN_PARENT = (b"location", b"^~", b"/api/v1/admin/")


class RoutingDrift(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise RoutingDrift(message)


@dataclass(frozen=True)
class Directive:
    words: tuple
    start: int
    end: int
    body: int | None       # Byte offset immediately after the opening brace.
    children: tuple


_token = re.compile(rb'''(?:\$\{[A-Za-z0-9_]+\}|\$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\\.|[^\s#$ {};"'\\])+|[{};]|\s+|\#[^\n]*''')


def parse(data):
    """Read directive boundaries, retaining source offsets for byte-exact edits."""
    stack = []
    children = []
    words = []
    pos = start = 0
    while pos < len(data):
        match = _token.match(data, pos)
        require(match is not None, "UNSUPPORTED_CONFIG_TOKEN")
        token = match.group()
        offset, pos = pos, match.end()
        if token.isspace() or token.startswith(b"#"):
            continue
        if token == b"}":
            require(not words and stack, "UNBALANCED_CONFIG")
            head, opening, body, parent = stack.pop()
            parent.append(Directive(head, opening, pos, body, tuple(children)))
            children = parent
        elif token in (b";", b"{"):
            require(words, "EMPTY_DIRECTIVE")
            if token == b"{":
                stack.append((tuple(words), start, pos, children))
                children = []
            else:
                children.append(Directive(tuple(words), start, pos, None, ()))
            words = []
        else:
            if not words:
                start = offset
            if token[:1] in (b'"', b"'") and token[-1:] == token[:1]:
                token = token[1:-1]
            words.append(token)
    require(not words and not stack, "INCOMPLETE_CONFIG")
    return tuple(children)


def named(nodes, name):
    return [node for node in nodes if node.words[0] == name]


def one(nodes, reason):
    require(len(nodes) == 1, reason)
    return nodes[0]


def walk(nodes):
    for node in nodes:
        yield node
        yield from walk(node.children)


def server_for(nodes, hostname):
    found = []
    for server in named(nodes, b"server"):
        names = named(server.children, b"server_name")
        if not any(hostname in (name.lower() for name in entry.words[1:]) for entry in names):
            continue
        tls = any(b"ssl" in n.words[2:] and (n.words[1] == b"443" or n.words[1].endswith(b":443"))
                  for n in named(server.children, b"listen") if len(n.words) >= 2)
        if not tls:
            # Certbot can use a conditional 301 followed by a direct fallback 404.
            require(named(server.children, b"return") and not named(server.children, b"include")
                    and not named(walk(server.children), b"proxy_pass"), "AMBIGUOUS_NON_TLS_SERVER")
            continue
        require(len(names) == 1 and tuple(w.lower() for w in names[0].words) == (b"server_name", hostname), "ALIASED_OR_AMBIGUOUS_SERVER_NAME")
        found.append(server)
    return one(found, "MISSING_OR_AMBIGUOUS_SERVER")


def expand_server(nodes, original, includes):
    """Only reviewed literal include sources may supply additional server directives."""
    expanded = []
    for node in nodes:
        if node.words[0] != b"include":
            expanded.append((node, original))
            continue
        require(len(node.words) == 2 and node.words[1] in includes and not any(c in node.words[1] for c in (b"*", b"?", b"[", b"$")), "UNRESOLVED_SERVER_INCLUDE")
        key = node.words[1]
        items = parse(includes[key])
        # Never accept a proxy/location hidden in a snippet or use its offsets as edits.
        if key == RECOVERY_INCLUDE:
            require(sha256(includes[key]).hexdigest() == RECOVERY_SHA256, "RECOVERY_INCLUDE_DRIFT")
            require([item.words for item in items] == [ADMIN_PARENT, (b"location", b"^~", b"/api/v1/support/"),
                    (b"location", b"=", b"/api/v1/me/mobile-activity")], "RECOVERY_LOCATION_DRIFT")
            for item in items:
                require(item.body is not None and all(n.body is None for n in item.children), "RECOVERY_SCOPE_DRIFT")
                proxy = one(named(item.children, b"proxy_pass"), "RECOVERY_PROXY_COUNT")
                require(proxy.words == (b"proxy_pass", RECOVERY_UPSTREAM), "RECOVERY_UPSTREAM_DRIFT")
        else:
            require(all(item.body is None and item.words[0] not in (b"include", b"proxy_pass", b"server_name") for item in items), "UNSUPPORTED_SERVER_INCLUDE")
        expanded.extend((item, includes[key]) for item in items)
    return expanded


def root_location(server, expected):
    location = one([n for n in server.children if n.words == (b"location", b"/")], "DEFAULT_LOCATION_DRIFT")
    require(not any(n.body is not None or n.words[0] in (b"include", b"rewrite", b"try_files", b"return") for n in location.children), "UNRESOLVED_DEFAULT_LOCATION")
    proxy = one(named(location.children, b"proxy_pass"), "DEFAULT_PROXY_COUNT")
    require(proxy.words == (b"proxy_pass", expected), "DEFAULT_UPSTREAM_DRIFT")
    return location, proxy


def has_top_level_alternative(regex):
    depth = 0
    escaped = in_class = False
    for token in regex:
        if escaped:
            escaped = False
        elif token == ord("\\"):
            escaped = True
        elif in_class:
            in_class = token != ord("]")
        elif token == ord("["):
            in_class = True
        elif token == ord("("):
            depth += 1
        elif token == ord(")"):
            depth -= 1
        elif token == ord("|") and depth == 0:
            return True
    return False


def verify_neighbors(nodes):
    for node in named(nodes, b"location"):
        if node.words == (b"location", b"/"):
            continue
        args = node.words[1:]
        require(len(args) in (1, 2), "UNSUPPORTED_LOCATION")
        mode, path = (b"", args[0]) if len(args) == 1 else args
        if path.startswith(b"@") and not mode:
            continue
        if mode in (b"~", b"~*"):
            # A literal anchored path prefix can prove disjointness. A general
            # regex could consume a descendant and would be superseded by ^~.
            literal = re.match(rb'^\^(/[A-Za-z0-9/_-]*)', path)
            require(literal is not None, "POTENTIALLY_OVERLAPPING_REGEX")
            prefix = literal.group(1).lower()
            if path[literal.end():literal.end() + 1] in (b"*", b"?", b"{"):
                prefix = prefix[:-1]
            for target in API_PATHS:
                require(not has_top_level_alternative(path) and not target.startswith(prefix)
                        and not prefix.startswith(target + b"/"), "POTENTIALLY_OVERLAPPING_REGEX")
            continue
        require(mode in (b"", b"^~", b"=") and path.startswith(b"/") and b"\\" not in path, "UNSUPPORTED_LOCATION")
        for target in API_PATHS:
            overlaps = path == target or path.startswith(target + b"/") or (mode != b"=" and target.startswith(path))
            require(not overlaps, "OVERLAPPING_SUPPORT_LOCATION")


def replace_spans(data, edits):
    for start, end, value in sorted(edits, reverse=True):
        data = data[:start] + value + data[end:]
    return data


def proxy_change(data, proxy, old, new):
    match = list(re.finditer(re.escape(old), data[proxy.start:proxy.end]))
    hit = one(match, "AMBIGUOUS_PROXY_VALUE")
    return proxy.start + hit.start(), proxy.start + hit.end(), new


TIMEOUTS = (b"proxy_connect_timeout", b"proxy_read_timeout", b"proxy_send_timeout")


def effective_timeouts(nodes, inherited):
    values = dict(inherited)
    for name in TIMEOUTS:
        entries = named(nodes, name)
        if not entries:
            continue
        n = one(entries, "AMBIGUOUS_PROXY_TIMEOUT")
        require(len(n.words) == 2, "AMBIGUOUS_PROXY_TIMEOUT")
        duration = re.fullmatch(rb"(\d+)(ms|s|m|h)?", n.words[1])
        require(duration is not None, "UNSUPPORTED_PROXY_TIMEOUT")
        factor = {None: 1000, b"ms": 1, b"s": 1000, b"m": 60000, b"h": 3600000}[duration[2]]
        values[name] = min(60_000, int(duration[1]) * factor or 60_000)
    return values


def new_locations(original, location, proxy, inherited_headers, target, old_upstream, inherited_timeouts):
    # Clone the actual default body (including request/auth headers and access
    # control). Override only the upstream, cache policy and proxy timeouts.
    cache_names = {b"expires", b"proxy_cache", b"proxy_connect_timeout", b"proxy_read_timeout", b"proxy_send_timeout"}
    timeouts = effective_timeouts(location.children, inherited_timeouts)
    edits = [proxy_change(original, proxy, old_upstream, API_NEW)]
    for n in location.children:
        key = n.words[0]
        cache_header = len(n.words) >= 2 and n.words[1].lower() == b"cache-control"
        if key in cache_names or (cache_header and key in (b"add_header", b"proxy_pass_header", b"proxy_hide_header")):
            edits.append((n.start, n.end, b""))
    local_headers = named(location.children, b"add_header")
    if not local_headers:
        require(inherited_headers is not None, "EFFECTIVE_INHERITED_HEADERS_REQUIRED")
    block = original[location.body:location.end - 1]
    body = replace_spans(block, [(a - location.body, b - location.body, v) for a, b, v in edits])
    additions = []
    if not local_headers:
        additions.extend(line for line in inherited_headers if parse(line)[0].words[1].lower() != b"cache-control")
    additions.extend(key + b" " + str(value).encode() + b"ms;" for key, value in sorted(timeouts.items()))
    additions.extend((b"proxy_cache off;", b"expires off;", b"proxy_hide_header Cache-Control;", b'add_header Cache-Control "no-store" always;'))
    body += b"\n        " + b"\n        ".join(additions) + b"\n    "
    return b"".join(b"location " + prefix + b" { " + body + b"}\n    "
                    for prefix in (b"= " + target, b"^~ " + target + b"/"))


def check_inherited_upstream_header(node):
    # The local hide rule in the four new locations replaces Nginx's inherited
    # upstream hide/pass policy as a group. Do not silently drop a parent rule.
    require(node.words[0] not in (b"proxy_hide_header", b"proxy_pass_header"), "INHERITED_UPSTREAM_HEADER_POLICY")


def candidate(original, expected_sha=BASE_SHA256, *, includes=None, http_add_headers=None, http_timeout_nodes=()):
    """http_add_headers is the observed HTTP-level fallback (an empty tuple means none)."""
    require(sha256(original).hexdigest() == expected_sha, "STAGING_PREIMAGE_DRIFT")
    nodes = parse(original)
    require(not named(nodes, b"include"), "UNRESOLVED_TOP_LEVEL_INCLUDE")
    api = server_for(nodes, API_HOST)
    admin = server_for(nodes, ADMIN_HOST)
    sources = includes or {}
    api_nodes = expand_server(api.children, original, sources)
    expand_server(admin.children, original, sources)
    require(not any(n.words[0] in (b"add_header_inherit", b"rewrite", b"try_files", b"return") for n, _ in api_nodes), "UNREVIEWED_API_ROUTING_OR_HEADERS")
    require(not any(n.words[0] == b"proxy_pass_header" and n.words[1].lower() == b"cache-control" for n, _ in api_nodes), "CONFLICTING_UPSTREAM_CACHE_HEADER")
    for node, _ in api_nodes:
        check_inherited_upstream_header(node)
    recovery = [(n, source) for n, source in api_nodes if n.words == ADMIN_PARENT
                and RECOVERY_INCLUDE in sources and source is sources[RECOVERY_INCLUDE]]
    require(len(recovery) <= 1 and (expected_sha != BASE_SHA256 or len(recovery) == 1), "RECOVERY_PARENT_COUNT")
    verify_neighbors([n for n, _ in api_nodes if not recovery or n is not recovery[0][0]])
    api_root, api_proxy = root_location(api, API_OLD)
    _, admin_proxy = root_location(admin, ADMIN_OLD)
    proxies = named(walk(nodes), b"proxy_pass")
    upstreams = [re.split(rb"[/\?#]", n.words[1][7:], maxsplit=1)[0] for n in proxies
                 if len(n.words) == 2 and n.words[1].startswith(b"http://")]
    require(upstreams.count(ADMIN_OLD[7:]) == 1, "ADMIN_UPSTREAM_COUNT_DRIFT")
    require(all(url[7:] not in upstreams for url in (API_NEW, ADMIN_NEW)), "CANDIDATE_UPSTREAM_ALREADY_PRESENT")
    require(not named(api_root.children, b"add_header_inherit"), "UNREVIEWED_API_ROUTING_OR_HEADERS")
    headers = [source[n.start:n.end] for n, source in api_nodes if n.words[0] == b"add_header"]
    if not headers and http_add_headers is not None:
        for line in http_add_headers:
            n = one(parse(line), "HTTP_ADD_HEADER_SOURCE_INVALID")
            require(n.words[0] == b"add_header" and len(n.words) in (3, 4) and n.body is None, "HTTP_ADD_HEADER_SOURCE_INVALID")
            headers.append(line[n.start:n.end])
    added = []
    inherited_timeouts = effective_timeouts([n for n, _ in api_nodes],
        effective_timeouts(http_timeout_nodes, dict.fromkeys(TIMEOUTS, 60_000)))
    for target in API_PATHS:
        if recovery and target.startswith(ADMIN_PARENT[2]):
            parent, source = recovery[0]
            proxy = one(named(parent.children, b"proxy_pass"), "RECOVERY_PROXY_COUNT")
            upstream = RECOVERY_UPSTREAM
        else:
            parent, source, proxy, upstream = api_root, original, api_proxy, API_OLD
        added.append(new_locations(source, parent, proxy, headers if headers or http_add_headers is not None else None,
                                   target, upstream, inherited_timeouts))
    return replace_spans(original, [
        (api_root.start, api_root.start, b"".join(added)),
        proxy_change(original, admin_proxy, ADMIN_OLD, ADMIN_NEW),
    ])


def verify_candidate(original, proposed, **context):
    require(candidate(original, **context) == proposed, "UNEXPECTED_ROUTING_DELTA")
    return sha256(proposed).hexdigest()


def current_state(original, observed, **context):
    calculated = candidate(original, **context)
    if observed == original:
        return "original"
    require(observed == calculated, "UNEXPECTED_ROUTING_DELTA")
    return "candidate"


def read_pinned_paths(staging, enabled, primary, primary_enabled, *,
                      staging_sha=BASE_SHA256, primary_sha):
    """Read only. Invoke on the two reviewed, absolute available/enabled path pairs."""
    data = []
    for target, link, expected in ((staging, enabled, staging_sha), (primary, primary_enabled, primary_sha)):
        target, link = Path(target), Path(link)
        require(target.is_absolute() and target.resolve(strict=True) == target and target.is_file(), "AVAILABLE_PATH_DRIFT")
        require(link.is_absolute() and link.parent.resolve(strict=True) == link.parent and link.is_symlink(), "ENABLED_LINK_DRIFT")
        direct = link.parent / os.readlink(link)
        require(not direct.is_symlink() and direct.name == target.name and direct.parent.samefile(target.parent)
                and link.resolve(strict=True) == target, "ENABLED_LINK_DRIFT")
        content = target.read_bytes()
        require(sha256(content).hexdigest() == expected, "ROUTING_FILE_PIN_DRIFT")
        data.append(content)
    return data[0]
