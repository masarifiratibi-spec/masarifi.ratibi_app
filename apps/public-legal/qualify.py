"""Qualify the actual static bytes and six loopback HTTP responses."""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import http.client
import json
from pathlib import Path
import tarfile
import threading
import subprocess
import tempfile
from urllib.parse import urlsplit

import build
import preview


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags, self.links, self.paragraphs, self.headings = [], [], [], []
        self.root = {}
        self.article = False
        self.capture = None
        self.text = ""

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        self.tags.append(tag)
        assert not any(name.startswith("on") for name in attributes), "Inline handler"
        if tag == "html":
            self.root = attributes
        if tag == "article":
            self.article = True
        if tag in {"a", "link"}:
            self.links.append((tag, attributes))
        if self.article and tag in {"p", "h2"}:
            self.capture, self.text = tag, ""

    def handle_endtag(self, tag):
        if tag == self.capture:
            (self.paragraphs if tag == "p" else self.headings).append(self.text)
            self.capture = None
        if tag == "article":
            self.article = False

    def handle_data(self, data):
        if self.capture:
            self.text += data


def qualify(candidate: Path, output: Path) -> dict:
    if not __debug__:
        raise RuntimeError("Qualification requires Python assertions; do not run with -O")
    manifest = preview.load_candidate(candidate)
    assert len(manifest["files"]) == 8 and len(manifest["stylesheets"]) == 2
    archive_path = candidate / "masarifi-public-legal.tar"
    assert (candidate / "SHA256SUMS").read_text(encoding="ascii") == hashlib.sha256(archive_path.read_bytes()).hexdigest() + "  " + archive_path.name + "\n"
    with tarfile.open(archive_path) as archive:
        assert sorted(archive.getnames()) == sorted("site/" + name for name in manifest["files"])
        assert all(entry.isfile() and entry.mode == 0o644 for entry in archive)
        for name, expected in manifest["files"].items():
            assert hashlib.sha256(archive.extractfile("site/" + name).read()).hexdigest() == expected["sha256"]
    checks, responses = [], []
    with preview.server(candidate) as httpd:
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        connection = http.client.HTTPConnection("127.0.0.1", httpd.server_port, timeout=5)
        try:
            for route in build.ROUTES:
                for language in ("ar", "en"):
                    path = "/" + route + "?lang=" + language
                    connection.request("GET", path)
                    response = connection.getresponse()
                    body = response.read()
                    assert response.status == 200 and response.getheader("Content-Type") == "text/html; charset=utf-8"
                    assert response.getheader("Content-Security-Policy") == preview.CSP
                    assert response.getheader("Referrer-Policy") == "no-referrer"
                    assert response.getheader("X-Content-Type-Options") == "nosniff"
                    assert body == (candidate / "site" / f"{route}.{language}.html").read_bytes()
                    parsed = Page()
                    parsed.feed(body.decode("utf-8"))
                    assert parsed.root["lang"] == language
                    assert parsed.root["dir"] == ("rtl" if language == "ar" else "ltr")
                    assert not set(parsed.tags) & {"script", "iframe", "object", "embed", "form", "input", "button", "img", "base"}
                    resources = [attributes["href"] for tag, attributes in parsed.links if tag == "link" and attributes.get("rel") == "stylesheet"]
                    assert len(resources) == 1 and resources[0][1:] in manifest["stylesheets"].values()
                    for tag, attributes in parsed.links:
                        destination = attributes.get("href", "")
                        if tag == "a":
                            assert destination.startswith("#") or destination.startswith("mailto:" + build.EMAIL) or (urlsplit(destination).path in ["/" + r for r in build.ROUTES] and not urlsplit(destination).netloc)
                    if route != "delete-account":
                        canonical = build.legal_document(route, language)
                        assert parsed.paragraphs == [p for section in canonical["sections"] for p in section["paragraphs"]]
                        assert parsed.headings == [section["title"] for section in canonical["sections"]]
                    else:
                        text = body.decode("utf-8")
                        assert build.MAILTO in text
                        assert "status below" not in text and "تظهر حالة الطلب أدناه" not in text
                        notice = "Sending an email starts a request; it does not confirm deletion." if language == "en" else "إرسال البريد يبدأ طلباً ولا يؤكد اكتمال الحذف."
                        assert notice in text
                    responses.append({"path": path, "status": response.status, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(), "direction": parsed.root["dir"], "fullCanonicalDocument": route != "delete-account"})
            checks.append("six-full-language-responses-and-canonical-paragraph-parity")
            for asset in manifest["stylesheets"].values():
                connection.request("GET", "/" + asset)
                response = connection.getresponse()
                body = response.read()
                assert response.status == 200 and response.getheader("Content-Type").startswith("text/css")
                assert hashlib.sha256(body).hexdigest() == manifest["files"][asset]["sha256"]
                assert b"url(" not in body and b"@import" not in body
            checks.append("both-stylesheets-served-and-no-resource-imports")
            rejected = ["/", "/admin", "/api", "/privacy/", "/privacy/extra", "/privacy.en.html", "/manifest.json", "/../manifest.json", "/%2e%2e/manifest.json", "/assets/public-legal/", "/assets/public-legal/../manifest.json", "/delete-accounting", "/.env", "/terms%2fen"]
            for path in rejected:
                connection.request("GET", path)
                response = connection.getresponse()
                response.read()
                assert response.status == 404, path
            for method in ("POST", "PUT", "PATCH", "DELETE"):
                connection.request(method, "/delete-account", body=b"unexpected")
                response = connection.getresponse()
                response.read()
                assert response.status == 405
            checks.append("fourteen-nonpublic-paths-and-four-mutations-rejected")
            for query in ("", "?lang=EN", "?lang=en&lang=ar", "?other=en", "?lang=en&other=x"):
                connection.request("GET", "/privacy" + query)
                response = connection.getresponse()
                assert response.read() == (candidate / "site/privacy.ar.html").read_bytes()
            checks.append("strict-language-fallback-matches-nginx-maps")
        finally:
            connection.close()
            httpd.shutdown()
            thread.join(timeout=3)
    # A hostile document must remain text, including in title and navigation.
    from unittest.mock import patch
    hostile = {"title": '<img src=x onerror="alert(1)">', "sections": [{"id": "safe", "title": "<script>bad</script>", "paragraphs": ['<iframe src="https://example.test"></iframe> & text']}]}
    with patch.object(build, "legal_document", return_value=hostile):
        parser = Page()
        parser.feed(build.page("privacy", "en", manifest["stylesheets"]["legal"]).decode())
        assert not set(parser.tags) & {"script", "iframe", "img"}
        assert parser.paragraphs == hostile["sections"][0]["paragraphs"]
    checks.append("hostile-document-content-escaped-through-full-renderer")
    qualify_source_guard()
    checks.append("real-git-descendant-release-admission-and-adapter-canonical-tamper-rejection")
    provenance = {name: manifest[name] for name in ("canonicalSourceCommit", "sourceCommit", "adapterCommit", "adapterTracked", "adapterGitMatched", "adapterClean", "previewOnly", "releaseAdmitted")}
    report = {**provenance, "checks": checks, "responses": responses, "payloadFileCount": 8, "staticOnly": True, "automatedDeletion": False, "externalRequestsNeeded": False, "liveDeploymentAcceptance": False, "ownerLegalContactRetentionAdoption": "pending"}
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return report


def qualify_source_guard():
    """Exercise real later commits, not a mocked ancestry answer."""
    from unittest.mock import patch
    directory = Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix="public-legal-git-", dir=directory) as temporary:
        root = Path(temporary).resolve()
        if root.parent != directory.resolve():
            raise ValueError("Unexpected temporary repository cleanup target")
        def git(*args):
            return subprocess.check_output(["git", "-c", "core.hooksPath=" + str(root / "no-hooks"), "-c", "commit.gpgsign=false", "-c", "user.name=Public legal qualification", "-c", "user.email=fixture@example.invalid", *args], cwd=root, stderr=subprocess.STDOUT, text=True).strip()
        git("init", "--initial-branch=main")
        canonical = root / "apps/mobile/src/features/legal/privacy.en.json"
        canonical.parent.mkdir(parents=True)
        original = '{"title":"Original","sections":[]}\n'
        canonical.write_text(original, encoding="utf-8")
        git("add", ".")
        git("commit", "-m", "Canonical base")
        base = git("rev-parse", "HEAD")
        adapter = root / "apps/public-legal/README.md"
        adapter.parent.mkdir(parents=True)
        adapter.write_text("Committed adapter\n", encoding="utf-8")
        with patch.object(build, "ROOT", root), patch.object(build, "CANONICAL_SOURCE", base):
            try:
                build.source_provenance()
                raise AssertionError("Untracked adapter was admitted")
            except ValueError:
                pass
            untracked = build.source_provenance(preview=True)
            assert not untracked["adapterTracked"] and untracked["adapterCommit"] is None
            assert untracked["previewOnly"] and not untracked["releaseAdmitted"]
        git("add", ".")
        git("commit", "-m", "Add adapter")
        adapter_commit = git("rev-parse", "HEAD")
        (root / "unrelated.txt").write_text("Later source commit\n", encoding="utf-8")
        git("add", ".")
        git("commit", "-m", "Later source")
        descendant = git("rev-parse", "HEAD")
        with patch.object(build, "ROOT", root), patch.object(build, "CANONICAL_SOURCE", base):
            admitted = build.source_provenance()
            assert admitted["sourceCommit"] == descendant != base
            assert admitted["adapterCommit"] == adapter_commit
            assert admitted["releaseAdmitted"] and admitted["adapterClean"]
            assert build.canonical_bytes(canonical.relative_to(root).as_posix()).decode() == original
            adapter.write_text("Unreviewed change\n", encoding="utf-8")
            try:
                build.source_provenance()
                raise AssertionError("Modified adapter was admitted")
            except ValueError:
                pass
            preparation = build.source_provenance(preview=True)
            assert preparation["previewOnly"] and not preparation["releaseAdmitted"] and not preparation["adapterGitMatched"]
            git("restore", "apps/public-legal/README.md")
            canonical.write_text('{"title":"Changed canonical","sections":[]}\n', encoding="utf-8")
            git("add", ".")
            git("commit", "-m", "Canonical content changed on descendant")
            try:
                build.canonical_bytes(canonical.relative_to(root).as_posix())
                raise AssertionError("Modified canonical document was admitted")
            except ValueError:
                pass
            git("checkout", "--orphan", "unrelated-history")
            git("commit", "-m", "Unrelated history")
            try:
                build.source_provenance(preview=True)
                raise AssertionError("Unrelated canonical history was admitted")
            except ValueError:
                pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = qualify(args.candidate.resolve(), args.output.resolve())
    print(json.dumps({"checksPassed": len(result["checks"]), "httpLanguageResponses": len(result["responses"]), "payloadFileCount": result["payloadFileCount"]}))
