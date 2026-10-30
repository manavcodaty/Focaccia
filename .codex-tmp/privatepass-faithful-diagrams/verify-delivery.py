from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import hashlib
import json
import re

base = Path('/Users/manavcodaty/repos/Focaccia')
out = base/'output/privatepass-faithful-diagrams'
build = base/'.codex-tmp/privatepass-faithful-diagrams'
reference = json.loads((build/'reference-content.json').read_text())
assert hashlib.sha256(Path(reference['source']).read_bytes()).hexdigest() == reference['sha256']
scene = json.loads((out/'Private Pass - Faithful Diagrams.excalidraw').read_text())
frames = [e for e in scene['elements'] if e['type']=='frame' and not e.get('isDeleted')]
assert len(frames)==19 and all(f['width']==1600 and f['height']==900 for f in frames)
for f,s in zip(frames,reference['slides']):
    assert f['customData']['spoken']==s['spoken']
    assert f['customData']['keyPoints']==s['keyPoints']
    assert f['customData']['title']==s['title']
coverage = {
 1:['Register','Get pass','Verify','One ticket. One person.','without a central face database'],
 2:['QR ticket','Can be shared','Stores lasting data','Links ticket + person'],
 3:['1:1 match','Ticket + registered face','Offline','Privacy','Evidence'],
 4:['Build the base','Connect the parts','Fix and improve','Local network','Syncing'],
 5:['Schroff et al. (2015)','Mai et al. (2019)','Rathgeb & Uhl (2011)','Josefsson & Liusvaara (2017)','Avoid claiming anonymity'],
 6:['Organiser','Ticket website','Enrolment phone','Gate phone'],
 7:['Attendee phone','Event service','Prepared gate','Accounts, events and tickets stored'],
 8:['One person One ticket','Event A ≠ Event B','Not proven: unlinkability'],
 9:['Signature','Encryption','Genuine pass','Who can read inside'],
 10:['Correct event and time','Valid digital signature','Not cancelled or already used','Face matches the ticket','First valid scan','Second scan: reject'],
 11:['Camera cropping','Repeated claims','request ID','Record before success'],
 12:['ownership','capacity','unwanted duplicates','reused-ticket rejection','Signed sync','mask trials','user study'],
 13:['Recorded','Automated','simulator','Later observed','Not measured'],
 14:['Prepare','Disconnect','Scan once','Scan again','Reconnect','Sync'],
 15:['Offline gate decisions','Stop ticket reuse','Limit central face storage','Proven face performance','Partial','Supported','By design','Not proven'],
 16:['Cancelled tickets','Shorter validity','Fake faces','mask tests','Usability','manual entry'],
 17:['Stop adding features sooner','device details','logs and outcomes','Set thresholds first','fresh examples'],
 18:['What I can show','What I cannot claim','prepared setup','Real tests are still needed'],
 19:['Why compare one face with one ticket','What tests support the offline checks','What would I test before a real event']
}
normalise=lambda t:' '.join(t.casefold().split())
for i,f in enumerate(frames,1):
    visible=normalise(' '.join(e.get('text','') for e in scene['elements'] if e.get('frameId')==f['id'] and not e.get('isDeleted')))
    for phrase in coverage[i]:
        assert normalise(phrase) in visible, (i,phrase)
for i in range(1,20):
    svg=ET.parse(out/f'svg/slide-{i:02}.svg').getroot()
    assert svg.attrib['viewBox']=='0 0 1600 900'
    assert not any(e.tag.endswith('foreignObject') for e in svg.iter())
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with ZipFile(out/'Private Pass - Faithful Diagrams - Final.pptx') as z:
    assert z.testzip() is None
    assert len([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)])==19
    assert len([n for n in z.namelist() if n.startswith('ppt/media/') and n.endswith('.svg')])==19
    for name in z.namelist():
        if name.endswith(('.xml','.rels','.svg')): ET.fromstring(z.read(name))
    for i,s in enumerate(reference['slides'],1):
        note=ET.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml'))
        text='\n'.join(t.text or '' for t in note.findall('.//a:t',ns))
        assert text.count('Spoken notes')==text.count('Key points')==1
        for unwanted in ['PRESENTER REMINDER','[Sources]','[Evidence]','[Stage direction]','Target 0:','SPEAKING SCRIPT','MEMORY CUES']:
            assert unwanted not in text
        normal=lambda t:' '.join(t.split())
        expected=normal('Spoken notes '+s['spoken']+' Key points '+s['keyPoints'])
        assert expected in normal(text), f'Content differs from reference on {i}'
preflight=json.loads((build/'preflight.json').read_text())
assert not preflight['failures'] and preflight['frames']==19
print('PASS: 19 frames, 19 SVGs, 19 slides; scripts and cues match the supplied deck; no extra note blocks; source unchanged; no preflight failures.')
