"""Offline only. All configuration bytes and hashes below are synthetic."""
import os
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import nginx_delta as ng


DEFAULT = b'''location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id;
        proxy_set_header Authorization $http_authorization;
        auth_request /internal-check;
        proxy_read_timeout 90s;
        proxy_connect_timeout 10s;
    }'''
SPECIAL = b'location ^~ /api/v1/tracking/device/ { proxy_pass http://127.0.0.1:3080; }'
ORIGINAL = b'''# proxy_pass http://127.0.0.1:3041; is a comment, never an edit target.
server { listen 80; server_name api.staging.masarifiratibi.com; return 301 https://$host$request_uri; }
server {
    listen 443 ssl;
    server_name api.staging.masarifiratibi.com;
    add_header X-Frame-Options "DENY" always;
    ''' + SPECIAL + b'''
    location ~ ^/dev-privacy/ { return 404; }
    ''' + DEFAULT + b'''
}
server {
    listen 443 ssl;
    server_name staging.masarifiratibi.com;
    location / { proxy_pass http://127.0.0.1:3041; }
}
server {
    listen 80;
    server_name staging.masarifiratibi.com;
    if ($host = staging.masarifiratibi.com) { return 301 https://$host$request_uri; }
    return 404;
}
'''


def build(data=ORIGINAL, **options):
    return ng.candidate(data, expected_sha=sha256(data).hexdigest(), **options)


class Delta(unittest.TestCase):
    def test_only_four_locations_and_one_literal_change(self):
        proposed = build()
        # Remove the inserted bytes + undo the one Admin change; byte equality
        # checks everything including comments, redirect server and special route.
        at = ORIGINAL.index(DEFAULT)
        resume = proposed.index(DEFAULT)
        self.assertEqual(proposed[:at], ORIGINAL[:at])
        self.assertEqual(proposed[resume:], ORIGINAL[at:].replace(ng.ADMIN_OLD + b";", ng.ADMIN_NEW + b";"))
        blocks = ng.parse(proposed[at:resume])
        self.assertEqual([node.words for node in blocks], [
            (b"location", mode, target + suffix) for target in ng.API_PATHS
            for mode, suffix in ((b"=", b""), (b"^~", b"/"))
        ])
        for block in blocks:
            directives = [n.words for n in block.children]
            self.assertEqual([args for args in directives if args[0] == b"proxy_pass"], [(b"proxy_pass", ng.API_NEW)])
            for header in (b"Host", b"X-Forwarded-For", b"Authorization", b"X-Request-ID"):
                self.assertIn(header, [args[1] for args in directives if args[0] == b"proxy_set_header"])
            self.assertIn((b"auth_request", b"/internal-check"), directives)
            self.assertIn((b"add_header", b"X-Frame-Options", b"DENY", b"always"), directives)
            self.assertIn((b"proxy_hide_header", b"Cache-Control"), directives)
            self.assertIn((b"add_header", b"Cache-Control", b"no-store", b"always"), directives)
            self.assertIn((b"proxy_cache", b"off"), directives)
            for name, value in ((b"proxy_send_timeout", b"60000ms"), (b"proxy_read_timeout", b"60000ms"), (b"proxy_connect_timeout", b"10000ms")):
                self.assertIn((name, value), directives)

    def test_drift_and_injected_foreign_change_cannot_be_accepted(self):
        digest = sha256(ORIGINAL).hexdigest()
        with self.assertRaisesRegex(ng.RoutingDrift, "PREIMAGE"):
            ng.candidate(ORIGINAL + b"# drift\n", expected_sha=digest)
        proposed = build()
        self.assertEqual(ng.verify_candidate(ORIGINAL, proposed, expected_sha=digest), sha256(proposed).hexdigest())
        self.assertEqual(ng.current_state(ORIGINAL, proposed, expected_sha=digest), "candidate")
        self.assertEqual(ng.current_state(ORIGINAL, ORIGINAL, expected_sha=digest), "original")
        with self.assertRaisesRegex(ng.RoutingDrift, "UNEXPECTED_ROUTING_DELTA"):
            ng.current_state(ORIGINAL, proposed.replace(b":3080;", b":3081;"), expected_sha=digest)

    def test_ambiguous_markers_and_nonunique_admin_proxy_abort(self):
        for data in (
            ORIGINAL + b'server { listen 443 ssl; server_name api.staging.masarifiratibi.com; location / { return 403; } }',
            ORIGINAL.replace(b"listen 443 ssl;", b"listen 80;"),
            ORIGINAL.replace(b"server_name staging.masarifiratibi.com;", b"server_name staging.masarifiratibi.com other.example;"),
            ORIGINAL.replace(ng.ADMIN_OLD + b"; }", b"http://127.0.0.1:3099; }"),
            ORIGINAL.replace(b"127.0.0.1:3080;", b"127.0.0.1:3041/path;"),
            ORIGINAL.replace(b"127.0.0.1:3080;", b"127.0.0.1:3042;"),
            ORIGINAL.replace(ng.API_OLD + b";", ng.API_OLD + b"/;"),
        ):
            with self.subTest(data=data), self.assertRaises(ng.RoutingDrift):
                build(data)

    def test_existing_overlap_general_regex_and_uninspected_includes_abort(self):
        for route in (
            b"location /api/v1/admin { return 403; }",
            b"location = /api/v1/me/support-access/requests { return 403; }",
            b"location ^~ /api/v1/admin/support-access/requests/children { return 403; }",
            b"location ~ ^/api/v1/(admin|other) { return 403; }",
            b"location ~ ^/unrelated|/api/v1/me { return 403; }",
            b"location ~ ^/api/v1/adminx?/support-access { return 403; }",
            b"location ~* [.]js$ { return 403; }",
            b"include /unobserved/snippet.conf;",
        ):
            with self.subTest(route=route), self.assertRaises(ng.RoutingDrift):
                build(ORIGINAL.replace(SPECIAL, route))
        # Similar names describe siblings and must not be routed to the new API.
        harmless = b"location /api/v1/me/support-access/requests-other { return 418; }"
        self.assertIn(harmless, build(ORIGINAL.replace(SPECIAL, harmless)))

    def test_header_inheritance_and_cache_policy(self):
        header = b'add_header X-Frame-Options "DENY" always;'
        data = ORIGINAL.replace(header, b"")
        with self.assertRaisesRegex(ng.RoutingDrift, "HEADERS_REQUIRED"):
            build(data)
        outer = b"add_header Access-Control-Allow-Origin $http_origin always;"
        self.assertEqual(build(data, http_add_headers=(outer,)).count(outer), 4)
        self.assertEqual(build(data, http_add_headers=()).count(b'Cache-Control "no-store" always;'), 4)
        local = data.replace(b"proxy_http_version 1.1;", b"add_header X-One yes; add_header Cache-Control public; proxy_http_version 1.1;")
        result = build(local, http_add_headers=(outer,))
        self.assertNotIn(outer, result)
        self.assertEqual(result.count(b"add_header X-One yes;"), 5)
        self.assertEqual(result.count(b"add_header Cache-Control public;"), 1)
        inc = data.replace(SPECIAL, b"include /observed/tls.conf;\n    " + SPECIAL)
        self.assertEqual(build(inc, includes={b"/observed/tls.conf": header}).count(header), 4)
        with self.assertRaisesRegex(ng.RoutingDrift, "UNSUPPORTED_SERVER_INCLUDE"):
            build(inc, includes={b"/observed/tls.conf": SPECIAL})
        with self.assertRaisesRegex(ng.RoutingDrift, "CONFLICTING_UPSTREAM_CACHE_HEADER"):
            build(data.replace(SPECIAL, b"proxy_pass_header Cache-Control;\n    " + SPECIAL), http_add_headers=())
        with self.assertRaisesRegex(ng.RoutingDrift, "UNRESOLVED_TOP_LEVEL_INCLUDE"):
            build(b"include other-sites.conf;\n" + ORIGINAL)

    def test_server_hide_or_pass_policy_cannot_be_lost_by_adding_a_local_hide_rule(self):
        for directive in (b"proxy_hide_header X-Internal-Trace;", b"proxy_pass_header Date;"):
            with self.subTest(directive=directive):
                with self.assertRaisesRegex(ng.RoutingDrift, "INHERITED_UPSTREAM_HEADER_POLICY"):
                    build(ORIGINAL.replace(SPECIAL, directive + b" " + SPECIAL))
                with self.assertRaisesRegex(ng.RoutingDrift, "INHERITED_UPSTREAM_HEADER_POLICY"):
                    build(ORIGINAL.replace(SPECIAL, b"include server.conf; " + SPECIAL), includes={b"server.conf": directive})
                # An existing local rule stays in the default and all four clones.
                self.assertEqual(build(ORIGINAL.replace(DEFAULT, DEFAULT.replace(b"proxy_http_version", directive + b" proxy_http_version"))).count(directive), 5)

    def test_pinned_tls_shape_with_certbot_include_and_two_redirect_hosts(self):
        tls = b"/etc/letsencrypt/options-ssl-nginx.conf"
        directive = b"include " + tls + b";\n    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
        data = ORIGINAL.replace(b"listen 443 ssl;", b"listen [::]:443 ssl;\n    " + directive)
        snippet = b"# Representative fixture only\nssl_protocols TLSv1.2 TLSv1.3;\nssl_session_tickets off;\n"
        result = build(data, includes={tls: snippet})
        self.assertEqual(result.count(directive), 2)
        self.assertIn(b"if ($host = staging.masarifiratibi.com) { return 301 https://$host$request_uri; }", result)
        self.assertEqual(result.count(b"listen 80;"), 2)

    @staticmethod
    def observed_specialized_blocks():
        # Head tokens from read-only admission. Bodies here are synthetic.
        heads = [
            b'~ "^/api/v1/accounts/[0-9a-fA-F-]{36}/summary$"', b"= /api/v1/transactions", b"^~ /api/v1/transactions/",
            b"^~ /api/v1/voice/", b"= /api/v1/meta/social-media", b"= /api/v1/admin/settings/mobile.social_links",
            b"= /api/v1/tracking/device/rule-snapshot", b"^~ /api/v1/tracking/device/",
            b"~* ^/api/v1/sync/(?:bootstrap|delta)/?$", b"~* ^/api/v1/voice/sessions/?$", b"~* ^/api/v1/assistant(?:/|$)",
            b"= /account-deletion/api/v1/me/deletion-requests", b"^~ /account-deletion/api/v1/privacy/deletion-completions/",
            b"= /account-deletion", b"^~ /account-deletion/", b"= /dev-account-deletion/api/v1/me/deletion-requests",
            b"^~ /dev-account-deletion/api/v1/privacy/deletion-completions/", b"= /dev-account-deletion",
            b"^~ /dev-account-deletion/", b"^~ /dev-privacy/", b"= /health/ready",
            b'~ "^/api/v1/transactions/[0-9a-fA-F-]{36}$"', b'~ "^/api/v1/obligations/[0-9a-fA-F-]{36}/payments$"',
            b'~ "^/api/v1/obligations/[0-9a-fA-F-]{36}/payments/[0-9a-fA-F-]{36}/reverse$"', b"= /api/v1/planning/summary",
        ]
        return b"\n    ".join(b"location " + head + b" { return 404; }" for head in heads)

    def test_observed_specialized_location_heads_remain_disjoint(self):
        specialized = self.observed_specialized_blocks()
        result = build(ORIGINAL.replace(SPECIAL, specialized))
        self.assertIn(specialized, result)

    def test_both_enabled_links_and_primary_bytes_are_pinned(self):
        with TemporaryDirectory() as temp:
            parent = Path(temp).resolve()
            staging, primary, enabled, primary_enabled = (parent / name for name in ("stage", "primary", "stage-enabled", "primary-enabled"))
            staging.write_bytes(ORIGINAL)
            primary.write_bytes(b"unmodified primary")
            options = {"staging_sha": sha256(ORIGINAL).hexdigest(), "primary_sha": sha256(primary.read_bytes()).hexdigest()}
            try:
                enabled.symlink_to(staging)
                primary_enabled.symlink_to(primary)
            except OSError:
                if os.name == "nt": self.skipTest("Host does not allow Windows symlink creation")
                raise
            self.assertEqual(ng.read_pinned_paths(staging, enabled, primary, primary_enabled, **options), ORIGINAL)
            primary_enabled.unlink()
            primary_enabled.symlink_to(staging)
            with self.assertRaisesRegex(ng.RoutingDrift, "ENABLED_LINK_DRIFT"):
                ng.read_pinned_paths(staging, enabled, primary, primary_enabled, **options)
            primary_enabled.unlink()
            alias = parent / "indirect-alias"
            alias.symlink_to(primary)
            primary_enabled.symlink_to(alias)
            with self.assertRaisesRegex(ng.RoutingDrift, "ENABLED_LINK_DRIFT"):
                ng.read_pinned_paths(staging, enabled, primary, primary_enabled, **options)
            primary_enabled.unlink()
            primary_enabled.symlink_to(primary)
            primary.write_bytes(b"changed primary")
            with self.assertRaisesRegex(ng.RoutingDrift, "FILE_PIN_DRIFT"):
                ng.read_pinned_paths(staging, enabled, primary, primary_enabled, **options)


if __name__ == "__main__":
    unittest.main()
