from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import hashlib
import json
import re

source = Path('/Users/manavcodaty/Library/Mobile Documents/com~apple~CloudDocs/Praco Family/EPQ/Mav/PrivatePass_EPQ Presentation_v4.pptx')
build = Path('/Users/manavcodaty/repos/Focaccia/.codex-tmp/privatepass-diagram-edition')
ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
slides = []
with ZipFile(source) as z:
    names = sorted((n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)), key=lambda n:int(re.search(r'(\d+)\.xml',n)[1]))
    for i, name in enumerate(names, 1):
        visible = '\n'.join(t.text or '' for t in ET.fromstring(z.read(name)).findall('.//a:t', ns))
        rels = ET.fromstring(z.read(f'ppt/slides/_rels/slide{i}.xml.rels'))
        note_rel = next(r.attrib['Target'] for r in rels if r.attrib['Type'].endswith('/notesSlide'))
        notes = '\n'.join(t.text or '' for t in ET.fromstring(z.read('ppt/'+note_rel.removeprefix('../'))).findall('.//a:t',ns))
        script = notes.split('SPEAKING SCRIPT\n',1)[1].split('\nPRESENTER REMINDER',1)[0].split('\nMEMORY CUES',1)[0]
        cues = notes.split('MEMORY CUES\n',1)[1].strip()
        title = notes.split(' — ',1)[1].split('  |',1)[0]
        slides.append(dict(title=title, spoken=' '.join(script.split()), keyPoints=cues, originalSlideText=visible, sources=[str(source)+f' — slide {i}'], claim=title))
assert len(slides) == 19
result = dict(source=str(source),sha256=hashlib.sha256(source.read_bytes()).hexdigest(),slides=slides)
(build/'reference-content.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(slides=len(slides),spokenWords=sum(len(s['spoken'].split()) for s in slides),sourceSha256=result['sha256'])))
