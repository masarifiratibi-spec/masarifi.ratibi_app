import subprocess, pathlib, sys, xml.etree.ElementTree as E
p=pathlib.Path(__file__).parent/'evidence'; name=sys.argv[1]
a=['adb','-s','RK8XB00N33K']
(p/(name+'.png')).write_bytes(subprocess.check_output(a+['exec-out','screencap','-p']))
subprocess.run(a+['shell','uiautomator','dump','/sdcard/window-assistant-review.xml'],capture_output=True)
subprocess.run(a+['pull','/sdcard/window-assistant-review.xml',str(p/(name+'.xml'))],capture_output=True)
r=E.parse(p/(name+'.xml'))
for n in r.iter('node'):
 if n.get('text') or n.get('content-desc'): print(n.get('text'),n.get('content-desc'),n.get('bounds'))
