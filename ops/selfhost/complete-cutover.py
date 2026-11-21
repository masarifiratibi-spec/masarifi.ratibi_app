"""Close the one-way migration only after actual server and physical-device acceptance."""
import importlib.util
import json
from pathlib import Path
import time

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)

def main():
 state_path=Path('/etc/masarifi/selfhost/cutover-state.json');state=json.loads(state_path.read_text())
 assert state['phase']=='operational-target-awaiting-final-acceptance' and state['targetMayAcceptWrites']
 io.load('verify-operational').main()
 tracking=json.loads((ROOT/'tracking-operational-verification.json').read_text())
 assert tracking['state']=='passed' and tracking['operational'] and tracking['publicHttps'] and tracking['readOnly']
 assert json.loads((ROOT/'owned-trials-cleaned.json').read_text())['state']=='passed'
 phone=json.loads((ROOT/'phone-offline-operational-verification.json').read_text())
 assert phone['state']=='passed' and phone['duplicateRows']==0 and phone['networkSettingsRestored']
 assert int(io.target("select count(*) from public.transactions where title='Selfhost phone offline R11';"))==1
 mobile=json.loads((ROOT/'mobile-update-139-acceptance.json').read_text())
 assert mobile['state']=='passed' and mobile['versionCode']==139 and mobile['uidPreserved'] and mobile['bothProfilesDataInodesPreserved']
 assert mobile['conciseTrackingObserved'] and mobile['conciseAssistantObserved'] and mobile['tests']==94
 state['phase']='complete';state['acceptanceCompletedAt']=time.time()
 state['acceptanceReceipts']=['operational-server-acceptance.json','tracking-operational-verification.json','phone-offline-operational-verification.json','mobile-update-139-acceptance.json','owned-trials-cleaned.json']
 io.atomic_json(state_path,state)
 receipt={'state':'complete','targetMayAcceptWrites':True,'servingTargetConsumers':len(state['newConsumers']),'frozenSourceConsumers':len(state['sourceConsumers']),'phoneOfflineNoDuplicate':True,'mobileVersionCode':139,'maintenanceSeconds':round(state['maintenanceEndedAt']-state['startedAt'],3),'retainedDump':False}
 io.atomic_json(ROOT/'migration-complete.json',receipt);print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
