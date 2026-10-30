from pathlib import Path
import re

OUT = Path(__file__).resolve().parent.parent
SKILL = Path('/Users/manavcodaty/.codex/skills/nasa-handbook')
template = (SKILL / 'assets/template.html').read_text()
head = template.split('<div class="page">')[0]
head = head.replace('[DOC NUMBER] [PROGRAM] Operations Handbook, page [2.1-1]', 'Private Pass | Audience Handout')
head = head.replace('--paper: #fbfaf5;', '--paper: #ffffff;')
head = head.replace('</style>', '''
  /* Larger text for an audience handout; retain the handbook structure. */
  .page { font-size: 11pt; line-height: 1.28; letter-spacing: .025em; }
  .head .doc, .head .title { font-size: 10pt; }
  .head .part { font-size: 9pt; margin-top: 1.4mm; }
  .opener { margin: 3mm 0; line-height: 1.4; font-size: 12pt; }
  .para { grid-template-columns: 14mm 1fr; margin-top: 2.4mm; }
  .para p { text-indent: 0; margin-bottom: 1.5mm; }
  .para .num { font-size: 9pt; padding-top: .6mm; }
  .para h2, .para h3 { margin-bottom: 1.2mm; font-size: 10pt; }
  figure { margin-top: 2mm; }
  figcaption { font-size: 9pt; }
  svg .lbl { font-size: 3px; }
  svg .lbl-s { font-size: 2.8px; }
  svg .lbl-b { font-size: 3.2px; }
  table { font-size: 10pt; line-height: 1.25; }
  th, td { padding: 1.1mm 1.8mm; }
  .tcap { font-size: 9pt; margin: 2mm 0 1mm; }
  .lower { grid-template-columns: 1fr 71mm; column-gap: 5mm; }
  .notice p { font-size: 10pt; line-height: 1.25; }
  .notice { margin-top: 2.5mm; }
  .notice .tag { font-size: 10pt; }
  .card { font-size: 9pt; line-height: 1.4; margin-top: 3mm; }
  .card li { white-space: normal; }
  .source { font-size: 8pt; line-height: 1.25; margin-top: 3mm; }
  .foot .line { font-size: 9pt; }
  .foot .sub { font-size: 9pt; }
</style>''')
script = template[template.index('<script>'):]

def para(n, title, text, sub=False):
    tag = 'h3' if sub else 'h2'
    return f'<section class="para"><div class="num">{n}</div><div><{tag}>{title}</{tag}><p>{text}</p></div></section>'

def fig(n, height, caption, content, alt):
    return f'''<figure><svg viewBox="0 0 180 {height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{alt}">
    {content}<text class="code" x="179" y="{height-1}" text-anchor="end">PPS-50{n}A</text></svg>
    <figcaption><span class="n">Figure {n}.</span>{caption}</figcaption></figure>'''

def boxes(items, y=8, height=21):
    s = ''
    for i, lines in enumerate(items):
        x = 1 + i*46
        s += f'<rect class="box" x="{x}" y="{y}" width="40" height="{height}"/>'
        for j, line in enumerate(lines):
            s += f'<text class="lbl" x="{x+20}" y="{y+6+j*5}" text-anchor="middle">{line}</text>'
        if i < len(items)-1:
            s += f'<line class="wa" x1="{x+40}" y1="{y+height/2}" x2="{x+45.5}" y2="{y+height/2}"/>'
    return s

def page(n, subtitle, body):
    return head + f'''<div class="page">
    <header class="head"><div class="doc">PP2A-03 / AUDIENCE REFERENCE</div>
    <div class="title">PRIVATE PASS REFERENCE HANDBOOK</div><div class="part">MANAV CODATY · EXTENDED PROJECT QUALIFICATION</div><div class="rule"></div></header>
    <div class="tab">PPS</div><div class="opener">SECTION {n}<br>{subtitle}</div>
    {body}
    <footer class="foot"><div class="rule"></div><div class="sub">PRIVATE PASS · PRESENTATION COMPANION</div>
    <div class="line"><span>Source: Presentation v4</span><span>28 October 2026</span><span>Page {n} of 2</span></div></footer>
    </div>''' + script

def table(caption, headings, rows):
    return '<div class="tcap">'+caption+'</div><table><thead><tr>'+''.join('<th>'+x+'</th>' for x in headings)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+x+'</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table>'

lookup = '<div style="font-size:9.5pt;border-bottom:.6pt solid black;padding-bottom:2mm;margin-bottom:2mm">FACE WORDS / MATCH ERRORS: PAGE 1 &nbsp; · &nbsp; PASS SECURITY / OFFLINE / TEST CLAIMS: PAGE 2</div>'
p1 = lookup + para('1.1', 'WHAT IS FACE DATA?',
    'A face image is a picture. Face data is a set of numbers that a computer makes from that picture. A face template is another name for this set. Private Pass changes the numbers for each event before it puts them in a pass (figure 1).')
p1 += fig(1, 33, 'A Picture Becomes Data in a Pass', boxes([
    ['FACE IMAGE','A picture','from the camera'],
    ['FACE DATA','Numbers from','the picture'],
    ['EVENT VERSION','Numbers changed','for this event'],
    ['PASS','Face data','in encrypted form']], 3, 23),
    'A face picture becomes numbers. Private Pass changes those numbers for the event and puts encrypted face data in the pass.')
p1 += para('1.2', 'WHAT DOES 1:1 MEAN?',
    'A 1:1 check compares one person with one pass. Example: Alex shows a pass. The gate compares Alex’s face with the face data in that pass. It does not search a list of all visitors.')
p1 += para('1.3', 'WHAT DOES THE MATCH LIMIT DO?',
    'The match limit sets how close the two sets of numbers must be. With a small permitted difference, the gate can reject the correct person. With a large permitted difference, it can accept the wrong person. These are different errors (figure 2).')
p1 += fig(2, 39, 'Two Possible Errors in a Face Check', '''
    <text class="lbl-s" x="1" y="4">EXAMPLES OF ERRORS, NOT PRIVATE PASS TEST RESULTS</text>
    <rect class="box" x="1" y="8" width="42" height="10"/>
    <text class="lbl" x="22" y="14.3" text-anchor="middle">CORRECT PERSON</text>
    <line class="wa" x1="43" y1="13" x2="56.5" y2="13"/>
    <rect class="box" x="57" y="8" width="42" height="10"/>
    <text class="lbl" x="78" y="14.3" text-anchor="middle">ENTRY REJECTED</text>
    <text class="lbl" x="107" y="14.3">FALSE REJECTION</text>
    <rect class="box" x="1" y="23" width="42" height="10"/>
    <text class="lbl" x="22" y="29.3" text-anchor="middle">WRONG PERSON</text>
    <line class="wa" x1="43" y1="28" x2="56.5" y2="28"/>
    <rect class="box" x="57" y="23" width="42" height="10"/>
    <text class="lbl" x="78" y="29.3" text-anchor="middle">ENTRY ACCEPTED</text>
    <text class="lbl" x="107" y="29.3">FALSE ACCEPTANCE</text>''',
    'A false rejection rejects the correct person. A false acceptance accepts the wrong person. These are explanatory examples, not measured results.')
p1 += '<div class="lower"><div>' + table('Table 1. Face Terms: Quick Lookup', ['Term in the talk','Meaning'], [
    ('Pass','A digital ticket with face data.'),
    ('Gate','The device for the entry check.'),
    ('Enrollment','Connects a person’s face to a pass.'),
    ('Template','Numbers made from a face image.'),
    ('Embedding','Another name for a template.'),
    ('Spoof attack','An attempt to enter with a fake face.')]) + '</div><div>'
p1 += '<div class="notice"><span class="tag">NOTE</span><p>Face data can show private information about a person. Numbers do not remove every privacy risk.</p></div>'
p1 += '<div class="card"><div class="bar"><span>FIND AN EXPLANATION</span></div><ol><li><span>1</span><span>Find the term in a heading.</span></li><li><span>2</span><span>Read the short explanation.</span></li><li><span>3</span><span>Use the example or drawing.</span></li><li><span>4</span><span>Use the table for other terms.</span></li></ol></div></div></div>'

p2 = lookup + para('2.1', 'SIGNED AND ENCRYPTED: WHAT IS THE DIFFERENCE?',
    'A digital signature lets the gate examine the source of a pass and find changes to it. Encryption changes face data into a form that only a prepared gate can read. A digital signature gives no encryption. A copied pass can still have a correct digital signature. The gate must also compare the face with the pass (figure 3).')
p2 += fig(3, 30, 'Each Check Answers a Different Question', '''
    <rect class="box" x="1" y="2" width="56" height="23"/>
    <text class="lbl-b" x="29" y="8" text-anchor="middle">DIGITAL SIGNATURE</text>
    <text class="lbl" x="29" y="14" text-anchor="middle">WHO ISSUED THIS PASS?</text>
    <text class="lbl" x="29" y="20" text-anchor="middle">DID THE PASS CHANGE?</text>
    <rect class="box" x="62" y="2" width="56" height="23"/>
    <text class="lbl-b" x="90" y="8" text-anchor="middle">ENCRYPTION</text>
    <text class="lbl" x="90" y="14" text-anchor="middle">WHO CAN READ</text>
    <text class="lbl" x="90" y="20" text-anchor="middle">THE FACE DATA?</text>
    <rect class="box" x="123" y="2" width="56" height="23"/>
    <text class="lbl-b" x="151" y="8" text-anchor="middle">FACE CHECK</text>
    <text class="lbl" x="151" y="14" text-anchor="middle">DOES THIS FACE AGREE</text>
    <text class="lbl" x="151" y="20" text-anchor="middle">WITH THIS PASS?</text>''',
    'A signature checks source and changes. Encryption restricts reading. A face check compares the person with the pass.')
p2 += para('2.2', 'HOW CAN THE GATE OPERATE OFFLINE?',
    'Offline means no internet connection. The gate first downloads event data while it has an internet connection. It can then use the saved data for the entry decision. The server is the central computer for accounts and ticket records. The design does not keep face data here for use across different events.')
p2 += fig(4, 30, 'Offline Means Local Decisions, Then a Later Update', '''
    <rect class="box" x="1" y="3" width="50" height="20"/>
    <text class="lbl-b" x="26" y="9" text-anchor="middle">BEFORE ENTRY</text>
    <text class="lbl" x="26" y="15" text-anchor="middle">Download event data.</text>
    <text class="lbl-s" x="26" y="20" text-anchor="middle">INTERNET CONNECTED</text>
    <line class="wa" x1="51" y1="13" x2="64.5" y2="13"/>
    <rect class="box" x="65" y="3" width="50" height="20"/>
    <text class="lbl-b" x="90" y="9" text-anchor="middle">AT THE GATE</text>
    <text class="lbl" x="90" y="15" text-anchor="middle">Decide; save ticket use.</text>
    <text class="lbl-s" x="90" y="20" text-anchor="middle">NO INTERNET</text>
    <line class="wa" x1="115" y1="13" x2="128.5" y2="13"/>
    <rect class="box" x="129" y="3" width="50" height="20"/>
    <text class="lbl-b" x="154" y="9" text-anchor="middle">AFTER RECONNECTION</text>
    <text class="lbl" x="154" y="15" text-anchor="middle">Send the entry record.</text>
    <text class="lbl-s" x="154" y="20" text-anchor="middle">INTERNET CONNECTED</text>''',
    'Before entry, the gate downloads event data. Offline, it makes local decisions and saves ticket use. After reconnection, it sends the entry record.')
p2 += para('2.3', 'WHY CAN A CANCELED TICKET STILL PASS?',
    'Example: A gate goes offline. The organizer then cancels a ticket. The gate cannot receive that change until it connects again. Offline entry uses the information already on the gate.')
p2 += '<div class="lower"><div>' + table('Table 2. How to Read a Test Claim', ['Phrase in the talk','What it establishes'], [
    ('Software test','A check of a specified part under test conditions.'),
    ('Observed run','Someone saw the system operate. This alone gives no repeat test record.'),
    ('Prototype','A test system. This word gives no performance result.')]) + '</div><div>'
p2 += '<div class="notice"><span class="tag">NOTE</span><p>A detected face can be a photo or a screen. Face detection alone does not stop a spoof attack.</p></div>'
p2 += '<div class="card"><div class="bar"><span>EXAMINE A TEST CLAIM</span></div><ol><li><span>1</span><span>Find what the test measured.</span></li><li><span>2</span><span>Find the test conditions.</span></li><li><span>3</span><span>Look for a saved test record.</span></li><li><span>4</span><span>Look for more than one test.</span></li></ol></div></div></div>'
p2 += '<div class="source">Based on PrivatePass_EPQ Presentation_v4.pptx and its speaker notes. Examples explain concepts; they are not recorded test results.</div>'

for n, title, body in [(1, 'FACE DATA AND MATCH ERRORS', p1), (2, 'PASS SECURITY AND OFFLINE ENTRY', p2)]:
    html = page(n,title,body)
    html = re.sub(r'(<text\b[^>]*>)(.*?)(</text>)', lambda m:m[1]+m[2].upper()+m[3], html)
    assert not re.search(r'\[[A-Z][A-Z ]+\]', html)
    (OUT / f'privatepass-companion-{n}.html').write_text(html)
print('Built two reference companion pages.')

