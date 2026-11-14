"""Build code-only console bundles locally. Never use this for data or credentials."""
import base64
import hashlib
import json
from pathlib import Path
import sys
import zlib


def main():
    name, command, *names = sys.argv[1:]
    root = Path(__file__).resolve().parent
    script = ["python3 - <<'MASARIFI_CODE_TRANSFER'", "from pathlib import Path", "import zlib,base64,hashlib,subprocess", "root=Path('/var/tmp/masarifi-selfhost-20261113')"]
    for relative in names:
        temporary=Path.home() / 'AppData/Local/Temp/masarifi-selfhost-transfer-20261113'
        file = (temporary / 'build/src' / relative.removeprefix('compiled/')) if relative.startswith('compiled/') else (temporary/relative if relative.startswith('fixtures/') else root/relative)
        assert '..' not in Path(relative).parts and not Path(relative).is_absolute() and file.is_file()
        body = file.read_bytes()
        encoded = base64.b64encode(zlib.compress(body, 9)).decode()
        script.extend(["b=zlib.decompress(base64.b64decode(" + repr(encoded) + "))", "assert hashlib.sha256(b).hexdigest()==" + repr(hashlib.sha256(body).hexdigest()), "p=root/" + repr(relative) + ";p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);p.chmod(0o600)"])
    script.append("subprocess.run(" + repr(json.loads(command)) + ",check=True)")
    script.append('MASARIFI_CODE_TRANSFER')
    output = Path.home() / 'AppData/Local/Temp/masarifi-selfhost-transfer-20261113' / (name + '.txt')
    output.write_text('\n'.join(script) + '\n', encoding='utf-8')
    print(json.dumps({'bundle': output.name, 'files': len(names), 'bytes': output.stat().st_size}))


if __name__ == '__main__':
    main()
