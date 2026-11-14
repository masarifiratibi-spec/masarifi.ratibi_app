"""Build a data-free public legal site from the canonical mobile documents."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import tarfile
import io

ROOT = Path(__file__).resolve().parents[2]
CANONICAL_SOURCE = "a95f37a91dcbdf174dfc4e58a7ad511ee6f3f718"
ORIGIN = "https://masarifiratibi.com"
EMAIL = "masarifi.ratibi@gmail.com"
MAILTO = "mailto:" + EMAIL + "?subject=Account%20deletion%20request"
ROUTES = ("privacy", "terms", "delete-account")
LEGAL = "apps/mobile/src/features/legal"
CSS_ROOT = "apps/admin-web/src/features"
STYLE_SOURCES = {
    "legal": f"{CSS_ROOT}/public-legal/legal.module.css",
    "deletion": f"{CSS_ROOT}/public-deletion/deletion.module.css",
}
CSS_PREFIX = ":root{--font-dm-sans:Tahoma;--font-tajawal:Arial}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif}\n"
COPY = {
    "ar": {"brand": "مصاريفي وراتبي", "language": "English", "skip": "انتقل إلى المستند", "contents": "محتويات المستند", "legal": "معلومات قانونية وتواصل", "privacy": "سياسة الخصوصية", "terms": "الشروط والأحكام", "deletion": "طلب حذف الحساب والبيانات", "contact": "للاستفسارات المتعلقة بالخصوصية أو الدعم:"},
    "en": {"brand": "Masarifi & Ratibi", "language": "العربية", "skip": "Skip to the document", "contents": "Document contents", "legal": "Legal information and contact", "privacy": "Privacy Policy", "terms": "Terms & Conditions", "deletion": "Request account and data deletion", "contact": "For privacy or support enquiries:"},
}


def escaped(value: str) -> str:
    return html.escape(value, quote=True)


def canonical_bytes(relative: str) -> bytes:
    """Refuse modified or substituted canonical inputs, including line changes."""
    expected = subprocess.check_output(["git", "show", CANONICAL_SOURCE + ":" + relative], cwd=ROOT)
    actual = (ROOT / relative).read_bytes().replace(b"\r\n", b"\n")
    if expected != actual:
        raise ValueError("Canonical input differs from reviewed source: " + relative)
    return expected


def source_provenance(preview: bool = False) -> dict:
    """Distinguish reviewed canonical inputs from the actual adapter revision."""
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", CANONICAL_SOURCE, head], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if ancestor.returncode != 0:
        raise ValueError("Canonical source must be an ancestor of the current checkout; fetch its history")
    adapter_root = ROOT / "apps/public-legal"
    paths = sorted(path.relative_to(ROOT).as_posix() for path in adapter_root.rglob("*") if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc")
    tracked = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", "HEAD", "--", "apps/public-legal"], cwd=ROOT, text=True).splitlines()
    fully_tracked = bool(paths) and set(paths) == set(tracked)
    git_match = fully_tracked and all((ROOT / path).read_bytes().replace(b"\r\n", b"\n") == subprocess.check_output(["git", "show", head + ":" + path], cwd=ROOT) for path in paths)
    status = subprocess.check_output(["git", "status", "--porcelain", "--untracked-files=all", "--", "apps/public-legal"], cwd=ROOT, text=True).strip()
    clean = fully_tracked and git_match and not status
    if not preview and not clean:
        raise ValueError("Release admission requires the complete adapter to be committed, Git-matched and clean; --preview is preparation only")
    adapter_commit = subprocess.check_output(["git", "log", "-1", "--format=%H", "HEAD", "--", "apps/public-legal"], cwd=ROOT, text=True).strip() if fully_tracked else None
    return {"canonicalSourceCommit": CANONICAL_SOURCE, "sourceCommit": head, "adapterCommit": adapter_commit, "adapterTracked": fully_tracked, "adapterGitMatched": git_match, "adapterClean": clean, "previewOnly": preview, "releaseAdmitted": not preview and clean}


def legal_document(kind: str, language: str) -> dict:
    document = json.loads(canonical_bytes(f"{LEGAL}/{kind}.{language}.json"))
    identifiers = [section["id"] for section in document["sections"]]
    if len(identifiers) != len(set(identifiers)) or any(not re.fullmatch(r"[a-z][a-z0-9-]*", value) for value in identifiers):
        raise ValueError("Invalid or duplicate document anchor")
    return document


def header(route: str, language: str) -> str:
    alternate = "en" if language == "ar" else "ar"
    return '<header class="header"><span>مصاريفي وراتبي · Masarifi &amp; Ratibi</span>' + f'<a href="/{route}?lang={alternate}" hreflang="{alternate}" lang="{alternate}">{COPY[language]["language"]}</a></header>'


def footer(route: str, language: str) -> str:
    text = COPY[language]
    links = []
    for destination in ROUTES:
        current = ' aria-current="page"' if destination == route else ""
        label = text["deletion" if destination == "delete-account" else destination]
        links.append(f'<a href="/{destination}?lang={language}"{current}>{label}</a>')
    return '<footer class="footer"><nav aria-label="' + text["legal"] + '">' + "".join(links) + '</nav><p>' + text["contact"] + f' <a href="mailto:{EMAIL}"><bdi>{EMAIL}</bdi></a></p></footer>'


def document_html(kind: str, language: str) -> tuple[str, str]:
    document = legal_document(kind, language)
    text = COPY[language]
    contents = '<nav class="contents" aria-label="' + text["contents"] + '"><ol>'
    article = '<article id="legal-document" tabindex="-1">'
    for section in document["sections"]:
        identifier, title = section["id"], escaped(section["title"])
        contents += f'<li><a href="#{identifier}">{title}</a></li>'
        article += f'<section id="{identifier}" aria-labelledby="{identifier}-heading"><h2 id="{identifier}-heading">{title}</h2>'
        article += "".join("<p>" + escaped(paragraph) + "</p>" for paragraph in section["paragraphs"]) + "</section>"
    body = f'<a class="skip" href="#legal-document">{text["skip"]}</a><div class="container">' + header(kind, language)
    body += "<h1>" + escaped(document["title"]) + "</h1>" + contents + "</ol></nav>" + article + "</article>" + footer(kind, language) + "</div>"
    return document["title"], body


def deletion_html(language: str) -> tuple[str, str]:
    text = json.loads((Path(__file__).parent / "deletion-copy.json").read_text(encoding="utf-8"))[language]
    body = header("delete-account", language) + '<div class="grid"><section><h1>' + escaped(text["title"]) + '</h1><p class="intro">' + escaped(text["intro"]) + '</p></section><section class="details">'
    body += "".join("<p>" + escaped(text[key]) + "</p>" for key in ("effect", "retention"))
    body += '<div class="contact"><p>' + escaped(text["contact"]) + f'</p><p><a href="{MAILTO}"><bdi>{EMAIL}</bdi></a></p><p>' + escaped(text["emailNotice"]) + "</p></div></section></div>"
    # Keep the existing component's native language links and email-only request.
    labels = COPY[language]
    body += f'<nav class="legal" aria-label="{labels["legal"]}"><a href="/privacy?lang={language}">{labels["privacy"]}</a><a href="/terms?lang={language}">{labels["terms"]}</a></nav>'
    return text["title"], body


def page(route: str, language: str, stylesheet: str) -> bytes:
    title, body = deletion_html(language) if route == "delete-account" else document_html(route, language)
    direction = "rtl" if language == "ar" else "ltr"
    title = escaped(title + " | " + COPY[language]["brand"])
    canonical = ORIGIN + "/" + route + "?lang=" + language
    return ('<!doctype html>\n' + f'<html lang="{language}" dir="{direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title><meta name="robots" content="index,follow"><link rel="canonical" href="{canonical}"><link rel="alternate" hreflang="ar" href="{ORIGIN}/{route}?lang=ar"><link rel="alternate" hreflang="en" href="{ORIGIN}/{route}?lang=en"><link rel="stylesheet" href="/{stylesheet}"></head><body><main class="page" lang="{language}" dir="{direction}">{body}</main></body></html>\n').encode("utf-8")


def nginx_snippet(stylesheets: dict[str, str]) -> str:
    lines = ["# REVIEW ONLY. Maps belong in http {}; locations belong in the approved server {}.", "# Replace /ABSOLUTE/REVIEWED/PUBLIC/RELEASE with this candidate's extracted site directory.", "# No listen, server, TLS, DNS, upstream, Admin or authentication changes are defined.", "map $arg_lang $masarifi_legal_candidate {", "    default ar;", "    ~^en$ en;", "}", "map $args $masarifi_legal_language {", "    default ar;", "    ~^lang=(ar|en)$ $masarifi_legal_candidate;", "}"]
    for route in ROUTES:
        lines += [f"location = /{route} {{", "    root /ABSOLUTE/REVIEWED/PUBLIC/RELEASE;", f"    try_files /{route}.$masarifi_legal_language.html =404;", "    default_type text/html;", "    charset utf-8;", "    add_header Content-Security-Policy \"default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\" always;", "    add_header X-Content-Type-Options nosniff always;", "    add_header Referrer-Policy no-referrer always;", "    add_header Cache-Control \"public, max-age=300\";", "}"]
    for asset in stylesheets.values():
        lines += [f"location = /{asset} {{", "    root /ABSOLUTE/REVIEWED/PUBLIC/RELEASE;", "    try_files $uri =404;", "    default_type text/css;", "    add_header X-Content-Type-Options nosniff always;", "    add_header Cache-Control \"public, max-age=31536000, immutable\";", "}"]
    return "\n".join(lines) + "\n"


def build(output: Path, preview: bool = False) -> dict:
    output = output.resolve()
    if output.exists():
        raise FileExistsError("Use a new output directory; preserve earlier candidates")
    provenance = source_provenance(preview)
    input_paths = list(STYLE_SOURCES.values()) + [f"{LEGAL}/{kind}.{language}.json" for kind in ("privacy", "terms") for language in ("ar", "en")]
    input_bytes = {relative: canonical_bytes(relative) for relative in input_paths}
    site = output / "site"
    (site / "assets/public-legal").mkdir(parents=True)
    stylesheets, source_pins = {}, {}
    for name, relative in STYLE_SOURCES.items():
        raw = input_bytes[relative]
        if re.search(rb"(?:url\s*\(|@import)", raw, re.I):
            raise ValueError("Stylesheet may not fetch resources")
        data = CSS_PREFIX.encode() + raw
        asset = f"assets/public-legal/{name}.{hashlib.sha256(data).hexdigest()[:16]}.css"
        (site / asset).write_bytes(data)
        stylesheets[name] = asset
        source_pins[relative] = hashlib.sha256(raw).hexdigest()
    for kind in ("privacy", "terms"):
        for language in ("ar", "en"):
            relative = f"{LEGAL}/{kind}.{language}.json"
            source_pins[relative] = hashlib.sha256(input_bytes[relative]).hexdigest()
    for route in ROUTES:
        for language in ("ar", "en"):
            (site / f"{route}.{language}.html").write_bytes(page(route, language, stylesheets["deletion" if route == "delete-account" else "legal"]))
    files = {str(path.relative_to(site)).replace("\\", "/"): {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size} for path in sorted(site.rglob("*")) if path.is_file()}
    adapter = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(Path(__file__).parent.iterdir()) if path.is_file()}
    manifest = {**provenance, "canonicalOrigin": ORIGIN, "routes": list(ROUTES), "stylesheets": stylesheets, "canonicalInputs": source_pins, "adapterInputs": adapter, "files": files, "javascript": False, "automatedDeletion": False, "clerkOrApiRequests": False, "credentials": False, "deployed": False, "ownerLegalContactRetentionAdoption": "pending"}
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "nginx-locations-review.conf").write_text(nginx_snippet(stylesheets), encoding="utf-8")
    archive = output / "masarifi-public-legal.tar"
    with tarfile.open(archive, "w", format=tarfile.USTAR_FORMAT) as package:
        for name in files:
            data = (site / name).read_bytes()
            entry = tarfile.TarInfo("site/" + name)
            entry.size, entry.mode, entry.mtime = len(data), 0o644, 0
            package.addfile(entry, io.BytesIO(data))
    (output / "SHA256SUMS").write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name + "\n", encoding="ascii")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preview", action="store_true", help="Allow uncommitted adapter preparation; output is explicitly not release-admitted")
    arguments = parser.parse_args()
    result = build(arguments.output, arguments.preview)
    print(json.dumps({"files": len(result["files"]), "output": str(arguments.output), "previewOnly": result["previewOnly"], "releaseAdmitted": result["releaseAdmitted"], "deployed": False}))
