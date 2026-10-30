from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import hashlib
import json
import re

base = Path('/Users/manavcodaty/repos/Focaccia')
out = base/'output/privatepass-diagram-edition'
build = base/'.codex-tmp/privatepass-diagram-edition'
reference = json.loads((build/'reference-content.json').read_text())
assert hashlib.sha256(Path(reference['source']).read_bytes()).hexdigest() == reference['sha256']
scene = json.loads((out/'Private Pass - Diagram Edition.excalidraw').read_text())
frames = [e for e in scene['elements'] if e['type']=='frame' and not e.get('isDeleted')]
assert len(frames)==19 and all(f['width']==1600 and f['height']==900 for f in frames)
for f,s in zip(frames,reference['slides']):
    assert f['customData']['spoken']==s['spoken']
    assert f['customData']['keyPoints']==s['keyPoints']
for i in range(1,20):
    svg=ET.parse(out/f'svg/slide-{i:02}.svg').getroot()
    assert svg.attrib['viewBox']=='0 0 1600 900'
    assert not any(e.tag.endswith('foreignObject') for e in svg.iter())
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with ZipFile(out/'Private Pass - Diagram Edition.pptx') as z:
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
