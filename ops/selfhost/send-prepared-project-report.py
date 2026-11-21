"""Server-only explicit single-message runner. No args = inspect only. Never polls queues."""
import email.parser
import email.policy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path('/opt/masarifi/selfhost/releases/2026-11-13/smtp-project-test-20261114')
RECIPIENT = 'masarifi.ratibi@gmail.com'
WORKER = 'masarifi-requested-pdf-email-20261031-01'


def main():
    os.umask(0o077)
    manifest = json.loads((ROOT / 'prepared.json').read_text())
    raw = (ROOT / 'message.eml').read_bytes()
    pdf = (ROOT / 'report.pdf').read_bytes()
    assert manifest['state'] == 'prepared-not-sent' and manifest['recipient'] == RECIPIENT
    assert hashlib.sha256(raw).hexdigest() == manifest['emlSha256']
    assert hashlib.sha256(pdf).hexdigest() == manifest['pdfSha256']
    message = email.parser.BytesParser(policy=email.policy.default).parsebytes(raw)
    assert message['To'] == RECIPIENT and message['From'] == RECIPIENT
    assert not message.get_all('Cc') and not message.get_all('Bcc')
    assert message['Message-ID'] == manifest['messageId']
    attachments = list(message.iter_attachments())
    assert len(attachments) == 1 and attachments[0].get_payload(decode=True) == pdf
    if sys.argv[1:] != ['--send-once']:
        assert not sys.argv[1:], 'Use no arguments for inspection or --send-once after explicit send authorization'
        print(json.dumps({'state': 'prepared-not-sent', 'recipient': RECIPIENT,
                          'subject': manifest['subject'], 'pdfBytes': len(pdf),
                          'sendAlreadyAttempted': (ROOT / 'send-intent.json').exists()}))
        return
    worker = json.loads(subprocess.check_output(['docker', 'inspect', WORKER]))[0]
    assert worker['State']['Running'] and worker['Id'] == manifest['workerId']
    # Persist intent BEFORE contacting SMTP. Never auto-resend after ambiguity/failure.
    intent = ROOT / 'send-intent.json'
    with intent.open('x') as file:
        json.dump({'state': 'attempting', 'recipient': RECIPIENT, 'messageId': manifest['messageId'],
                   'atUtc': datetime.now(timezone.utc).isoformat()}, file)
    script = r"""
(async()=>{
 const fs=require('fs'),crypto=require('crypto');
 const payload=JSON.parse(fs.readFileSync(0,'utf8'));
 const recipient='masarifi.ratibi@gmail.com';
 if(payload.recipient!==recipient||process.env.EMAIL_FROM?.toLowerCase()!==recipient)throw Error();
 const modulePath='/app/dist/src/reports/reports.smtp.js';
 if(crypto.createHash('sha256').update(fs.readFileSync(modulePath)).digest('hex')!==payload.smtpModuleSha256)throw Error();
 const numeric=new Set(['EMAIL_SMTP_PORT','MASARIFI_EMAIL_SMTP_CONNECTION_TIMEOUT_MS','MASARIFI_EMAIL_SMTP_SOCKET_TIMEOUT_MS']);
 const config={getRequired:k=>{if(!process.env[k])throw Error();return numeric.has(k)?Number(process.env[k]):process.env[k]}};
 const transport=require(modulePath).createTlsMailTransport(config);
 try{
  const result=await transport.sendMail({envelope:{from:process.env.EMAIL_FROM,to:recipient},raw:Buffer.from(payload.emlBase64,'base64')});
  const accepted=(result.accepted??[]).some(x=>String(x).toLowerCase()===recipient);
  console.log(JSON.stringify({state:accepted?'smtp-accepted':'smtp-rejected',acceptedBySmtp:accepted,recipient,messageId:payload.messageId,inboxReceiptVerified:false}));
 }finally{transport.close()}
})().catch(()=>{console.log(JSON.stringify({state:'not-confirmed-do-not-resend',inboxReceiptVerified:false}));process.exitCode=1});
"""
    import base64
    payload = {**manifest, 'emlBase64': base64.b64encode(raw).decode()}
    try:
        result = subprocess.run(['docker', 'exec', '-i', WORKER, '/nodejs/bin/node', '-e', script],
                                input=json.dumps(payload), capture_output=True, text=True, timeout=60)
        outcome = json.loads(result.stdout)
    except Exception:
        outcome = {'state': 'not-confirmed-do-not-resend', 'inboxReceiptVerified': False}
    outcome['atUtc'] = datetime.now(timezone.utc).isoformat()
    (ROOT / 'send-result.json').write_text(json.dumps(outcome, indent=2))
    print(json.dumps(outcome))


if __name__ == '__main__':
    main()
