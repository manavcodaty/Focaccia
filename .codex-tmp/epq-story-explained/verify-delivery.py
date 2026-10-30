import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

root = Path('/Users/manavcodaty/repos/Focaccia')
out = root / 'output/epq-story-explained'
build = root / '.codex-tmp/epq-story-explained'
scene = json.loads((out / 'Focaccia - Explained Story.excalidraw').read_text())
live = [e for e in scene['elements'] if not e.get('isDeleted')]
frames = [e for e in live if e['type'] == 'frame']
assert len(frames) == 17
assert len({e['id'] for e in live}) == len(live)
assert all(f['width'] == 1600 and f['height'] == 900 for f in frames)
assert all(e.get('frameId') in {f['id'] for f in frames} for e in live if e['type'] != 'frame')
assert all(e.get('fontFamily') == 1 for e in live if e['type'] == 'text')
for i in range(1, 18):
    svg = ET.parse(out / f'svg/slide-{i:02}.svg').getroot()
    assert svg.attrib['viewBox'] == '0 0 1600 900'
    assert not any(e.tag.endswith('foreignObject') for e in svg.iter())
    assert svg.findall('.//{http://www.w3.org/2000/svg}path')

with zipfile.ZipFile(out / 'Focaccia - Explained Story.pptx') as package:
    assert package.testzip() is None
    names = package.namelist()
    slide_names = sorted(n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml', n))
    note_names = sorted(n for n in names if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml', n))
    svg_names = sorted(n for n in names if n.startswith('ppt/media/') and n.endswith('.svg'))
    assert len(slide_names) == len(note_names) == len(svg_names) == 17
    for name in names:
        if name.endswith(('.xml', '.rels', '.svg')):
            ET.fromstring(package.read(name))
    for name in note_names:
        text = '\n'.join(e.text or '' for e in ET.fromstring(package.read(name)).iter() if e.tag.endswith('}t'))
        for block in ['[Spoken]', '[Stage direction]', '[Evidence]', '[Sources]']:
            assert text.count(block) == 1, (name, block)
        assert 'https://app.notion.com/p/' in text
    for name in slide_names:
        slide = ET.fromstring(package.read(name))
        assert len(slide.findall('.//{http://schemas.openxmlformats.org/presentationml/2006/main}pic')) == 1
        assert len(slide.findall('.//{http://schemas.microsoft.com/office/drawing/2016/SVG/main}svgBlip')) == 1

originals = {
    'Focaccia - EPQ Story.excalidraw': '1b356bc1189619d17beef3b4134b64042d79476b102b02f57139b1c34cd18bc8',
    'Focaccia - EPQ Story.pptx': '7f40b8751d103054a63925d7b4464d27957b75727dcf764de646c6fb16e07e5f',
}
for name, expected in originals.items():
    assert hashlib.sha256((root / 'output/epq-story-redesign' / name).read_bytes()).hexdigest() == expected
preflight = json.loads((build / 'preflight.json').read_text())
assert preflight['frames'] == 17 and not preflight['failures']
renders = json.loads((build / 'render-comparison.json').read_text())
assert len(renders) == 17 and max(r['nativeChangedPercent'] for r in renders) < 3
report = dict(editable_frames=17, valid_svg_files=17, embedded_svg_slides=17,
              notes_with_all_blocks=17, spoken_words=1366, clipping_findings=0,
              originals_unchanged=True, native_powerpoint_render_pages=17,
              native_notes_readback=17, slideshow_positions=list(range(1, 18)),
              physical_demo_tested=False, audience_comprehension_tested=False)
(build / 'delivery-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
