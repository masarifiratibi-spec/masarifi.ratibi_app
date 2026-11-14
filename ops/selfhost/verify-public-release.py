"""Read-only public release smoke check; never submits deletion or notifications."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from datetime import datetime, timezone
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'https://masarifiratibi.com'


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.attributes, self.text = set(), [], {}, []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style'):
            self.hidden += 1
        if tag == 'html':
            self.attributes = attrs
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'a':
            self.links.append(attrs.get('href', ''))

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.text.append(value)


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'Masarifi-release-readiness/1'}), timeout=20) as response:
        return response.status, dict(response.headers), response.read().decode('utf-8')


def main():
    evidence = {'atUtc': datetime.now(timezone.utc).isoformat(), 'pages': [], 'failures': [],
                'deletionSubmitted': False, 'notificationsSent': False}
    for kind in ('privacy', 'terms', 'delete-account'):
        for lang in ('ar', 'en'):
            url = f'{ORIGIN}/{kind}?lang={lang}'
            status, headers, body = fetch(url)
            page = Page()
            page.feed(body)
            text = ' '.join(' '.join(page.text).split())
            checks = {'http200': status == 200, 'language': page.attributes.get('lang') == lang,
                      'direction': page.attributes.get('dir') == ('rtl' if lang == 'ar' else 'ltr'),
                      'alternateLanguageLink': f'/{kind}?lang={"en" if lang == "ar" else "ar"}' in page.links,
                      'privacyLink': f'/privacy?lang={lang}' in page.links,
                      'termsLink': f'/terms?lang={lang}' in page.links,
                      'anchorsResolve': all(link[1:] in page.ids for link in page.links if link.startswith('#'))}
            if kind in ('privacy', 'terms'):
                document = json.loads((ROOT / f'apps/mobile/src/features/legal/{kind}.{lang}.json').read_text(encoding='utf-8'))
                missing = [section['id'] for section in document['sections']
                           if any(' '.join(paragraph.split()) not in text for paragraph in section['paragraphs'])]
                checks['sourceParagraphsMatch'] = not missing
                checks['deletionLink'] = f'/delete-account?lang={lang}' in page.links
            else:
                missing = []
                checks['emailRequestRoute'] = 'mailto:masarifi.ratibi@gmail.com?subject=Account%20deletion%20request' in page.links
                checks['notClaimingCompletedDeletion'] = ('لا يعني إرسال الطلب اكتمال الحذف' in text if lang == 'ar' else 'Submitting a request does not confirm erasure' in text)
            failed = [key for key, passed in checks.items() if not passed]
            evidence['pages'].append({'url': url, 'status': status, 'sha256': hashlib.sha256(body.encode()).hexdigest(),
                                      'checks': checks, 'mismatchedSections': missing})
            if failed:
                evidence['failures'].append({'url': url, 'checks': failed, 'sections': missing})
    url = 'https://api.masarifiratibi.com/api/v1/meta/mobile-update'
    status, headers, body = fetch(url)
    expected = {'schemaVersion': 1, 'enabled': False, 'release': None,
                'storeUrl': 'https://play.google.com/store/apps/details?id=com.masarifi.mobile'}
    policy = json.loads(body)
    update_checks = {'http200': status == 200, 'exactDisabledPolicy': policy == expected,
                     'noStore': 'no-store' in {k.lower(): v for k, v in headers.items()}.get('cache-control', '')}
    evidence['mobileUpdate'] = {'url': url, 'policy': policy, 'checks': update_checks}
    if not all(update_checks.values()):
        evidence['failures'].append({'url': url, 'checks': update_checks})
    output = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'ops/selfhost/public-release-verification-2026-11-14.json')
    output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'pages': len(evidence['pages']), 'failures': evidence['failures'], 'updateChecks': update_checks}))
    return 1 if evidence['failures'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
