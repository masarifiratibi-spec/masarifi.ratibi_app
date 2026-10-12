"""Disposable GitHub VM: actual systemd link provenance with inert sleep, no app."""
import hashlib,importlib.util,json,os,pathlib,socket,subprocess,tempfile,uuid
P=pathlib.Path(__file__).resolve().parent
if os.environ.get('GITHUB_ACTIONS')!='true' or os.environ.get('GITHUB_REPOSITORY')!='masarifiratibi-spec/masarifi.ratibi_app' or os.getuid()!=0 or socket.gethostname()=='srv2006836':raise RuntimeError('DISPOSABLE_CI_ROOT_ONLY')
sp=importlib.util.spec_from_file_location('host',P/'canary-host.py');h=importlib.util.module_from_spec(sp);sp.loader.exec_module(h)
attempt=str(uuid.uuid4());root=pathlib.Path(tempfile.mkdtemp(prefix='masarifi-ci-monitor-',dir='/opt'));root.chmod(0o700)
obj=h.LocalHost(root,{'attempt':attempt},{})
# The unchanged production proof method inspects the real systemd manager; only the service payload is inert.
unit='[Unit]\nDescription=Disposable inert provenance test\n[Service]\nType=exec\nUser=root\nExecStart=/bin/sleep 60\nRestart=no\nTimeoutStopSec=5\n'
obj.unit_content=lambda:unit;target=root/obj.unit();link=pathlib.Path('/etc/systemd/system')/obj.unit()
def run(args):subprocess.run(args,check=True,capture_output=True,text=True,timeout=15)
report=None
try:
 if link.exists() or link.is_symlink():raise RuntimeError('FOREIGN_UNIT_PRESERVED')
 target.write_text(unit);target.chmod(0o600);run(['systemctl','link',str(target)]);run(['systemctl','start',obj.unit()])
 invocation=obj.run(['systemctl','show',obj.unit(),'--property=InvocationID','--value'])
 obj.save('monitor-invocation.json',{'invocation':invocation,'unitHash':hashlib.sha256(unit.encode()).hexdigest()})
 obj.monitor_proof()
 fragment=obj.run(['systemctl','show',obj.unit(),'--property=FragmentPath','--value'])
 report={'status':'PASS','actualSystemd':obj.run(['systemctl','--version']).splitlines()[0],'reportedFragment':fragment,'resolvedTargetMatches':pathlib.Path(fragment).resolve()==target,'exactSourceDropinsAndInvocationChecked':True,'servicePayload':'inert /bin/sleep only','applicationStarted':False,'stagingAccess':False}
finally:
 if link.is_symlink() and link.resolve()==target:
  run(['systemctl','stop',obj.unit()]);link.unlink();run(['systemctl','daemon-reload'])
 if root.parent!=pathlib.Path('/opt') or root.resolve()!=root or not root.name.startswith('masarifi-ci-monitor-'):raise RuntimeError('CLEANUP_PATH_CHANGED')
 for name in [obj.unit(),'monitor-invocation.json']:
  path=root/name
  if path.exists():path.unlink()
 root.rmdir()
if link.exists() or link.is_symlink() or root.exists():raise RuntimeError('CLEANUP_UNCONFIRMED')
report['cleanupVerified']=True
out=pathlib.Path(os.environ['RUNNER_TEMP'])/'systemd-monitor-report.json';out.write_text(json.dumps(report,indent=2));print(json.dumps(report))
