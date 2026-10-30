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
  .tab { right: 5mm; width: 7mm; height: 14mm; }
  .test-panel { border: .8pt solid var(--ink); align-self: start; }
  .test-panel h3 { margin: 0; padding: 1mm 1.5mm; background: var(--ink); color: var(--paper); font: 9pt var(--selectric); letter-spacing: 0; }
  .test-panel p { margin: 0; padding: 1.5mm; font-size: 10pt; line-height: 1.25; }
  svg .online { fill: none; stroke: var(--ink); stroke-width: .3; stroke-linejoin: round; marker-start: url(#nh-flow); marker-end: url(#nh-flow); }
</style>''')
head = head.replace('<defs>', '<defs><marker id="nh-flow" viewBox="0 0 6 4" refX="5.6" refY="2" markerWidth="2.4" markerHeight="1.3" markerUnits="userSpaceOnUse" orient="auto-start-reverse" preserveAspectRatio="none"><path d="M0,0 L6,2 L0,4 Z" fill="#000"/></marker>')
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
    <header class="head"><div class="doc">PP3A-03 / AUDIENCE REFERENCE</div>
    <div class="title">PRIVATE PASS SYSTEMS HANDBOOK</div><div class="part">MANAV CODATY · EXTENDED PROJECT QUALIFICATION</div><div class="rule"></div></header>
    <div class="tab">PPS</div><div class="opener">SECTION {n}<br>{subtitle}</div>
    {body}
    <footer class="foot"><div class="rule"></div><div class="sub">PRIVATE PASS · PRESENTATION COMPANION</div>
    <div class="line"><span>Source: Presentation v4</span><span>28 October 2026</span><span>Page {n} of 2</span></div></footer>
    </div>''' + script

def table(caption, headings, rows):
    return '<div class="tcap">'+caption+'</div><table><thead><tr>'+''.join('<th>'+x+'</th>' for x in headings)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+x+'</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table>'

lookup = '<div style="font-size:9.5pt;border-bottom:.6pt solid black;padding-bottom:2mm">SYSTEM MAP / PASS CREATION: PAGE 1 &nbsp; · &nbsp; GATE DECISION / OFFLINE RECORDS: PAGE 2</div>'
p1 = lookup + para('1.1', 'PROJECT AIM AND SYSTEM MAP.',
    'Manav built Private Pass, a prototype for offline face checks, to reduce ticket sharing and central face storage (figure 1).')
p1 += fig(1, 78, 'System Architecture: Online Links and Local Entry', '''
    <rect class="panel" x="1" y="1" width="178" height="37"/>
    <text class="lbl-s" x="4" y="5">ONLINE SERVICES</text>
    <rect class="box" x="4" y="11" width="45" height="19"/>
    <text class="lbl-b" x="26.5" y="17" text-anchor="middle">ORGANIZER WEBSITE</text>
    <text class="lbl" x="26.5" y="23" text-anchor="middle">Manage the event.</text>
    <line class="online" x1="49.5" y1="21" x2="64.5" y2="21"/>
    <rect class="box" x="65" y="8" width="50" height="27"/>
    <text class="lbl-b" x="90" y="14" text-anchor="middle">CENTRAL SERVER</text>
    <text class="lbl" x="90" y="20" text-anchor="middle">Accounts + tickets</text>
    <text class="lbl" x="90" y="26" text-anchor="middle">Pass signing</text>
    <text class="lbl-s" x="90" y="31" text-anchor="middle">No readable face template</text>
    <line class="online" x1="115.5" y1="21" x2="130.5" y2="21"/>
    <rect class="box" x="131" y="11" width="45" height="19"/>
    <text class="lbl-b" x="153.5" y="17" text-anchor="middle">TICKET WEBSITE</text>
    <text class="lbl" x="153.5" y="23" text-anchor="middle">Get a ticket.</text>
    <polyline class="online" points="77,35.5 77,44 32,44 32,51.5"/>
    <text class="lbl-s" x="4" y="42">ONLINE: PASS ISSUE</text>
    <polyline class="online" points="103,35.5 103,44 148,44 148,51.5"/>
    <text class="lbl-s" x="119" y="42">ONLINE: SETUP / SYNC</text>
    <rect class="box" x="4" y="52" width="57" height="20"/>
    <text class="lbl-b" x="32.5" y="58" text-anchor="middle">ATTENDEE PHONE APP</text>
    <text class="lbl" x="32.5" y="64" text-anchor="middle">Face processing</text>
    <text class="lbl" x="32.5" y="69" text-anchor="middle">Pass stored here</text>
    <line class="wa" x1="61" y1="62" x2="118.5" y2="62"/>
    <text class="lbl" x="90" y="58" text-anchor="middle">PASS QR AT ENTRY</text>
    <text class="lbl-s" x="90" y="67" text-anchor="middle">NO INTERNET REQUIRED</text>
    <rect class="box" x="119" y="52" width="57" height="20"/>
    <text class="lbl-b" x="147.5" y="58" text-anchor="middle">GATE PHONE APP</text>
    <text class="lbl" x="147.5" y="64" text-anchor="middle">Local face comparison</text>
    <text class="lbl" x="147.5" y="69" text-anchor="middle">Local entry records</text>
    <text class="lbl-s" x="4" y="76.5">DOUBLE ARROWS: REQUESTS + REPLIES</text>''',
    'Two websites exchange requests and replies with the server. The attendee phone exchanges encrypted pass requests and signatures. The gate exchanges setup requests, event data, and entry records with the server. Double arrowheads show two-way exchange. The single arrow shows the pass moving from the attendee phone to the gate.')
p1 += para('1.2', 'HOW DOES A FACE BECOME A PASS?',
    'The phone changes a face image into numbers. An event rule makes a template from those numbers. The phone encrypts it with the gate’s public key. The server examines ticket ownership and signs the pass. The phone shows the signed pass as a QR code (figure 2).')
p1 += fig(2, 31, 'Pass Creation: The Face Stays on the Phone', boxes([
    ['FACE IMAGE','Phone makes','face numbers.'],
    ['EVENT TEMPLATE','Phone applies','the event rule.'],
    ['ENCRYPTION','Phone uses','the gate key.'],
    ['SIGNED PASS','Server signs;','phone shows QR.']],3,23),
    'The phone makes face numbers, applies the event rule and encrypts the template. The server signs the pass after ticket checks. The phone shows the signed pass as a QR code.')
p1 += '<div class="lower"><div>'+table('Table 1. Essential Terms', ['Term','Meaning'],[
    ('Pass','A digital ticket with encrypted face data.'),
    ('Template','Numbers used for the face comparison.'),
    ('Key','Data to lock, open, or verify.'),
    ('Signature','Data for a source and change check.'),
    ('Encryption','A change that limits who can read data.'),
    ('Offline','Without an internet connection.')])+'</div><div>'
p1 += '<div class="notice"><span class="tag">NOTE</span><p>The server receives encrypted data, not the face image or readable template. The public key can be shared. The private key stays on the gate and opens the template. Face data still has privacy risks.</p></div>'
p1 += '</div></div>'

p2 = lookup + para('2.1', 'HOW DOES THE GATE DECIDE?',
    'The gate first downloads event rules, public keys, and cancellations. It uses these saved items offline. Figure 3 shows the normal acceptance path.')
steps = [
    (1,1,6,'READ + VERIFY','Read the QR.','Check the signature.'),
    (2,64,6,'CHECK RULES','Event, time, use,','cancellation list'),
    (3,127,6,'DECRYPT','Make encrypted','data readable.'),
    (4,127,40,'CAPTURE FACE','Camera detects','one face.'),
    (5,64,40,'COMPARE','Match limit: maximum','permitted difference'),
    (6,1,40,'SAVE FIRST','Mark pass used;','then show entry')]
drawing=''
for n,x,y,title,a,b in steps:
    drawing+=f'<rect class="box" x="{x}" y="{y}" width="52" height="24"/><text class="lbl-b" x="{x+26}" y="{y+6}" text-anchor="middle">{n} {title}</text><text class="lbl" x="{x+26}" y="{y+12}" text-anchor="middle">{a}</text><text class="lbl" x="{x+26}" y="{y+18}" text-anchor="middle">{b}</text>'
drawing+='''<line class="wa" x1="53" y1="18" x2="63.5" y2="18"/>
    <line class="wa" x1="116" y1="18" x2="126.5" y2="18"/>
    <line class="wa" x1="153" y1="30" x2="153" y2="39.5"/>
    <line class="wa" x1="127" y1="52" x2="116.5" y2="52"/>
    <line class="wa" x1="64" y1="52" x2="53.5" y2="52"/>
    <text class="lbl-s" x="1" y="71">A BAD PASS OR FAILED FACE CHECK GIVES A REJECTION.</text>'''
p2 += fig(3,75,'The Gate Checks the Pass, Then the Person',drawing,
    'Read and verify the pass, check event rules and local records, decrypt the template, capture a face, compare templates, then save ticket use before showing acceptance. A bad pass or failed face check gives rejection.')
p2 += para('2.2', 'WHAT HAPPENS INSIDE THE FACE COMPARISON?',
    'The gate applies the same event rule to the new face data. It counts differences between the new template and the pass template. The match limit sets the permitted difference. A small limit can reject the correct person. A large limit can accept the wrong person.')
p2 += para('2.3', 'WHAT HAPPENS TO AN ENTRY RECORD?',
    'The gate saves ticket use and an entry record before it shows entry approval. This stops another use on that gate. The entry record waits for a server connection (figure 4).')
p2 += fig(4,31,'Local Storage Keeps the Record Until Reconnection', '''
    <rect class="box" x="1" y="3" width="52" height="21"/>
    <text class="lbl-b" x="27" y="9" text-anchor="middle">ENTRY ACCEPTED</text>
    <text class="lbl" x="27" y="15" text-anchor="middle">Pass marked used</text>
    <text class="lbl" x="27" y="20" text-anchor="middle">Record saved locally</text>
    <line class="wa" x1="53" y1="13.5" x2="63.5" y2="13.5"/>
    <rect class="box" x="64" y="3" width="52" height="21"/>
    <text class="lbl-b" x="90" y="9" text-anchor="middle">WAIT ON THE GATE</text>
    <text class="lbl" x="90" y="15" text-anchor="middle">Record survives</text>
    <text class="lbl" x="90" y="20" text-anchor="middle">an app restart.</text>
    <line class="wa" x1="116" y1="13.5" x2="126.5" y2="13.5"/>
    <rect class="box" x="127" y="3" width="52" height="21"/>
    <text class="lbl-b" x="153" y="9" text-anchor="middle">CONNECT AGAIN</text>
    <text class="lbl" x="153" y="15" text-anchor="middle">Send signed record.</text>
    <text class="lbl" x="153" y="20" text-anchor="middle">Server updates entry.</text>''',
    'After the local record is saved, it waits on the gate and survives app restart. When connected, the gate sends a signed entry record and the server updates the entry.')
p2 += '<div class="lower" style="grid-template-columns:1fr 82mm"><div><div class="notice"><span class="tag">OFFLINE LIMIT</span><p>A gate cannot receive new cancellations while offline. It can use an old cancellation list. A new download is necessary to receive the changes.</p></div></div><section class="test-panel"><h3>WHAT DID I TEST OR ACHIEVE?</h3><p>A local software test rejected a second entry record for the same pass. This shows database protection against repeat records. It does not test face accuracy or fake-face protection.</p></section></div>'
p2 += '<div class="source">Result: gate-db.test.ts, duplicate-record check; verified 28 October 2026. The architecture and normal entry path are simplified.</div>'

for n,title,body in [(1,'ARCHITECTURE AND PASS CREATION',p1),(2,'LOCAL CHECKS AND ENTRY RECORDS',p2)]:
    html=page(n,title,body)
    html=re.sub(r'(<text\b[^>]*>)(.*?)(</text>)',lambda m:m[1]+m[2].upper()+m[3],html)
    assert not re.search(r'\[[A-Z][A-Z ]+\]',html)
    (OUT/f'privatepass-balanced-{n}.html').write_text(html)
print('Built two balanced architecture handout pages.')

