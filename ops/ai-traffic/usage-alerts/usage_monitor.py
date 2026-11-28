import datetime as dt
import fcntl
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
STATE = Path('/var/lib/masarifi-ai-usage-alerts')
DB = 'masarifi-postgres17'
MAIL = 'masarifi-requested-pdf-email-20261031-01'
QUERY = (ROOT / 'breaches.sql').read_text()
NAMES = {'financial_assistant': ('الشات', 25), 'voice_transcription': ('تحليل الصوت', 15)}

def query(sql):
    command = ['docker', 'exec', '-i', DB, 'psql', '-XqAt', '-h', '/tmp', '-U',
               'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
    sql = "BEGIN READ ONLY; SET LOCAL statement_timeout='4s';\n" + sql + ";\nCOMMIT;"
    return subprocess.run(command, input=sql, text=True, capture_output=True,
                          check=True, timeout=12).stdout.splitlines()

def scan(conn, now):
    origin, cursor = conn.execute('select origin,cursor from progress').fetchone()
    end = min(now - 15, cursor + 600)
    if end < origin:
        return
    since = max(origin, cursor - 120)
    sql = QUERY.format(source='private.ai_usage_events',start=max(origin,since-600),end=end,since=since)
    rows = query(sql)
    with conn:
        for line in rows:
            account, workload, event = line.split('|')
            event = int(event)
            prior = conn.execute('select max(event) from notices where account=? and workload=?',
                                 (account,workload)).fetchone()[0]
            if prior is None or event >= prior + 3600:
                conn.execute('insert into notices values(?,?,?,0)', (account, workload, event))
        conn.execute('update progress set cursor=?', (max(cursor,end),))
        conn.execute('delete from notices where sent=1 and event < ?', (end-7*86400,))
    print('scan_ok', end, flush=True)

def mail(payload):
    command = ['docker', 'exec', '-i', MAIL, '/nodejs/bin/node', '-e',
               (ROOT/'alert-mail.cjs').read_text()]
    response = subprocess.run(command, input=json.dumps(payload), capture_output=True,
                              text=True, timeout=38)
    if response.returncode or response.stdout.strip() != 'SMTP_ACCEPTED':
        safe = next((x for x in response.stderr.splitlines() if x.startswith('SMTP_FAILED')), 'sender failed')
        raise RuntimeError(safe)

def deliver(conn, sender=mail):
    rows = conn.execute('select account,workload,event from notices where sent=0 order by event,account,workload limit 30').fetchall()
    if not rows:
        return
    lines = []
    for account, workload, event in rows:
        name, limit = NAMES[workload]
        timestamp = dt.datetime.fromtimestamp(event, dt.timezone(dt.timedelta(hours=3)))
        lines.append(f'{name} | أكتر من {limit} في الدقيقة مرتين | مرجع الحساب {account[:16]} | {timestamp:%Y-%m-%d %H:%M:%S} بتوقيت الرياض')
    key = hashlib.sha256(json.dumps(rows).encode()).hexdigest()[:32]
    sender(dict(id=key, subject='مصاريفي | تنبيه تكرار تجاوز معدل الاستخدام', text='\n'.join(lines)))
    with conn:
        conn.executemany('update notices set sent=1 where account=? and workload=? and event=?',rows)
    print('alerts_accepted',len(rows),flush=True)

def initialize(conn, now):
    with conn:
        conn.execute('create table if not exists progress(origin integer not null,cursor integer not null)')
        conn.execute('insert into progress select ?,? where not exists(select 1 from progress)',(now,now))
        conn.execute('create table if not exists notices(account text, workload text,event integer,sent integer,primary key(account,workload,event))')
        conn.execute('create table if not exists smoke(id integer primary key)')

def selftest():
    cases = [('chat-ok','financial_assistant',25,25,70), ('chat-hit','financial_assistant',26,26,70),
             ('voice-ok','voice_transcription',15,15,60), ('voice-hit','voice_transcription',16,16,60),
             ('one-burst','financial_assistant',26,26,59),('expired','voice_transcription',16,16,541),
             ('only-first','financial_assistant',26,25,65),('only-second','financial_assistant',25,26,65)]
    values = ','.join("('%s','%s',%d,%d,%d)" % item for item in cases)
    fixture = f"""(SELECT c.u AS user_id,c.w AS workload,to_timestamp(1000+p.delta) AS created_at,
                  p.delta*100+n AS id FROM (VALUES {values}) c(u,w,a,b,gap)
                  CROSS JOIN LATERAL (VALUES (0,c.a),(c.gap,c.b)) p(delta,qty)
                  CROSS JOIN LATERAL generate_series(1,p.qty) n) fixture"""
    hits = query(QUERY.format(source=fixture,start=1000,end=2000,since=1000))
    assert set(hits) == {hashlib.sha256(k.encode()).hexdigest()+'|'+w+'|'+str(t) for k,w,t in
                         [('chat-hit','financial_assistant',1070),('voice-hit','voice_transcription',1060)]}
    conn = sqlite3.connect(':memory:')
    initialize(conn,1000)
    conn.execute("insert into notices values('simulated','financial_assistant',1070,0)")
    sent = []
    def unavailable(_):
        raise RuntimeError('simulated')
    try:
        deliver(conn,unavailable)
    except RuntimeError:
        pass
    deliver(conn,sent.append)
    deliver(conn,sent.append)
    assert len(sent)==1 and conn.execute('select sent from notices').fetchone()==(1,)
    print('selftest_passed')

def main():
    if sys.argv[1:] == ['--selftest']:
        return selftest()
    with (STATE/'lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        with sqlite3.connect(STATE/'state.sqlite') as conn:
            now = int(time.time())
            initialize(conn,now)
            if sys.argv[1:] == ['--test-mail']:
                if not conn.execute('select 1 from smoke where id=1').fetchone():
                    mail(dict(id='test-20261128-01',subject='Masarifi monitor test MSA-2811',
                              text='دي رسالة اختبار من سيرفر مصاريفي للتأكد من وصول تنبيهات الشات والصوت. الرسالة دي تجريبية.'))
                    conn.execute('insert into smoke values(1)')
                print('test_mail_accepted')
                return
            try:
                scan(conn,now)
            finally:
                deliver(conn)

if __name__=='__main__':
    main()
