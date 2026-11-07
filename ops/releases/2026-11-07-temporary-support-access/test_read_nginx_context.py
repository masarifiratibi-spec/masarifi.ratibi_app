"""All files/links are local temporary fixtures; there is no live Nginx dependency."""
import contextlib
import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import nginx_delta as ng
import read_nginx_context as driver
import test_nginx_delta as fixtures


class Context(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve() / "nginx"
        for directory in ("sites-available", "sites-enabled", "parts", "headers", "modules"):
            (self.root / directory).mkdir(parents=True)
        self.main = self.root / "nginx.conf"
        self.main.write_bytes(b"include main-part.conf;\nevents { worker_connections 100; }\n")
        (self.root / "main-part.conf").write_bytes(b"http { include parts/http.conf; }")
        # Relative nested include paths are resolved from the main config prefix.
        (self.root / "parts/http.conf").write_bytes(b"include headers/*.conf; include sites-enabled/*;")
        self.a = b'add_header X-One "private-fixture-value" always;'
        self.b = b"add_header X-Two $http_origin always;"
        (self.root / "headers/b.conf").write_bytes(self.b)
        (self.root / "headers/a.conf").write_bytes(self.a)
        self.tls = self.root / "tls.opts"
        self.tls.write_bytes(b"ssl_protocols TLSv1.2 TLSv1.3;")
        self.raw = fixtures.ORIGINAL.replace(b'add_header X-Frame-Options "DENY" always;', b"include tls.opts;")
        self.raw = self.raw.replace(fixtures.SPECIAL, fixtures.Delta.observed_specialized_blocks())
        self.stage = self.root / "sites-available" / driver.STAGING
        self.stage.write_bytes(self.raw)
        self.primary = self.root / "sites-available" / driver.PRIMARY
        self.primary.write_bytes(b"server { server_name primary.example; include primary-server-headers.conf; location / { return 404; } }")
        (self.root / "primary-server-headers.conf").write_bytes(b"add_header X-Private other-server-only; proxy_pass_header Cache-Control;")
        for file in (self.stage, self.primary):
            try:
                (self.root / "sites-enabled" / file.name).symlink_to(file)
            except OSError:
                if os.name == "nt": self.skipTest("Windows symlink privilege unavailable")
                raise

    def read(self):
        return driver.receipt(main=self.main, tls_snippet=self.tls, modules=self.root / "modules",
                              staging_hash=driver.digest(self.raw), primary_hash=driver.digest(self.primary.read_bytes()))

    def test_excludes_server_headers_resolves_includes_and_sanitizes_receipt(self):
        before = [(p, p.stat().st_mtime_ns) for p in sorted(self.root.rglob("*"))]
        result = self.read()
        expected = ng.candidate(self.raw, expected_sha=driver.digest(self.raw),
                                includes={b"tls.opts": self.tls.read_bytes()}, http_add_headers=(self.a, self.b))
        self.assertEqual(result["candidateSha256"], driver.digest(expected))
        self.assertEqual(result["httpAddHeaderCount"], 2)
        self.assertEqual(result["diff"]["changedAdminUpstream"], [ng.ADMIN_OLD.decode(), ng.ADMIN_NEW.decode()])
        self.assertEqual([(v["modifier"], v["uri"]) for v in result["diff"]["addedLocations"]],
                         [(mode, t.decode() + suffix) for t in ng.API_PATHS for mode, suffix in (("=", ""), ("^~", "/"))])
        report = json.dumps(result)
        for secret in ("private-fixture-value", "other-server-only", "$http_origin", str(self.root)):
            self.assertNotIn(secret, report)
        self.assertEqual([(p, p.stat().st_mtime_ns) for p in sorted(self.root.rglob("*"))], before)
        old_hash = result["contextSha256"]
        (self.root / "headers/a.conf").write_bytes(self.a + b"\n# harmless context-only change")
        new = self.read()
        self.assertNotEqual(new["contextSha256"], old_hash)
        self.assertEqual(new["candidateSha256"], result["candidateSha256"])

    def test_global_conflicts_fail_and_local_server_header_takes_precedence(self):
        for text in (b"rewrite ^ /wrong;", b"add_header_inherit merge;", b"proxy_pass_header Cache-Control;",
                     b"add_header Cache-Control public;", b'more_set_headers "Cache-Control: public";'):
            with self.subTest(text=text):
                (self.root / "headers/c.conf").write_bytes(text)
                with self.assertRaises(ng.RoutingDrift):
                    self.read()
        (self.root / "headers/c.conf").unlink()
        self.tls.write_bytes(b"add_header X-Server server-value always;")
        result = self.read()
        expected = ng.candidate(self.raw, expected_sha=driver.digest(self.raw),
                                includes={b"tls.opts": self.tls.read_bytes()}, http_add_headers=())
        self.assertEqual(result["candidateSha256"], driver.digest(expected))

    def test_http_include_with_upstream_header_policy_is_not_admitted(self):
        for directive in (b"proxy_hide_header X-Internal-Trace;", b"proxy_pass_header Date;"):
            with self.subTest(directive=directive):
                (self.root / "headers/c.conf").write_bytes(directive)
                with self.assertRaisesRegex(ng.RoutingDrift, "INHERITED_UPSTREAM_HEADER_POLICY"):
                    self.read()

    def test_primary_enabled_link_cannot_be_renamed_or_duplicated(self):
        original = self.root / "sites-enabled" / driver.PRIMARY
        alternate = original.with_name("00-alternate-primary")
        original.rename(alternate)
        with self.assertRaisesRegex(ng.RoutingDrift, "PRIMARY_ENABLED_LINK_DRIFT"):
            self.read()
        original.symlink_to(self.primary)
        with self.assertRaisesRegex(ng.RoutingDrift, "PRIMARY_ENABLED_LINK_DRIFT"):
            self.read()

    def test_inactive_pinned_link_and_duplicate_site_are_rejected(self):
        (self.root / "parts/http.conf").write_bytes(b"include headers/*.conf; include sites-enabled/masarifi-staging;")
        with self.assertRaisesRegex(ng.RoutingDrift, "PINNED_SITE_NOT_ENABLED"):
            self.read()
        (self.root / "parts/http.conf").write_bytes(b"include sites-enabled/*;")
        (self.root / "sites-enabled/extra-alias").symlink_to(self.stage)
        with self.assertRaisesRegex(ng.RoutingDrift, "PINNED_SITE_NOT_ENABLED"):
            self.read()

    def test_foreign_host_hidden_in_server_include_is_rejected(self):
        (self.root / "primary-server-headers.conf").write_bytes(b"server_name API.Staging.MasarifiRatibi.com;")
        with self.assertRaisesRegex(ng.RoutingDrift, "TARGET_HOST_IN_ANOTHER_SITE"):
            self.read()

    def test_cycle_private_path_and_membership_changes_are_rejected(self):
        nested = self.root / "headers/c.conf"
        nested.write_bytes(b"include headers/c.conf;")
        with self.assertRaisesRegex(ng.RoutingDrift, "RECURSIVE_INCLUDE"):
            self.read()
        nested.write_bytes(b"include ../private.key;")
        with self.assertRaisesRegex(ng.RoutingDrift, "UNREVIEWED_INCLUDE_PATTERN"):
            self.read()
        nested.unlink()
        stable = driver.Inputs.stable
        def introduce_change(instance):
            nested.write_bytes(b"# new member")
            stable(instance)
        with patch.object(driver.Inputs, "stable", introduce_change):
            with self.assertRaisesRegex(ng.RoutingDrift, "INCLUDE_MEMBERSHIP_CHANGED"):
                self.read()

    def test_driver_errors_do_not_print_raw_path_or_configuration(self):
        out = io.StringIO()
        with patch.object(driver, "receipt", side_effect=PermissionError("private-fixture-value")), contextlib.redirect_stdout(out):
            self.assertEqual(driver.main(), 1)
        self.assertEqual(json.loads(out.getvalue()), {"readOnly": True, "error": "CONFIG_CONTEXT_UNREADABLE"})


if __name__ == "__main__":
    unittest.main()
