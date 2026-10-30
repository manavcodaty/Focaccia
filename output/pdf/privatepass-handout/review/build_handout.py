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
    <header class="head"><div class="doc">PP1A-03 / AUDIENCE COPY</div>
    <div class="title">PRIVATE PASS HANDBOOK</div><div class="part">MANAV CODATY · EXTENDED PROJECT QUALIFICATION</div><div class="rule"></div></header>
    <div class="tab">PPS</div><div class="opener">SECTION {n}<br>{subtitle}</div>
    {body}
    <footer class="foot"><div class="rule"></div><div class="sub">PRIVATE PASS · PRESENTATION HANDOUT</div>
    <div class="line"><span>Source: Presentation v4</span><span>28 October 2026</span><span>Page {n} of 2</span></div></footer>
    </div>''' + script

p1 = para('1.1', 'SYSTEM FUNCTION.',
    'Private Pass is a test system for event entry. A person can give a copy of a ticket to someone else. Private Pass compares a person’s face with the face data in their pass. A prepared gate can do this check without the internet. The design does not keep face data on the server for use across different events.')
p1 += fig(1, 40, 'The Ticket Journey',
    '<text class="lbl-s" x="1" y="4">THE FIRST THREE STEPS USE THE INTERNET.</text>' +
    boxes([['EVENT','The organizer','sets up an event.'],['TICKET','The person gets','a ticket.'],['PHONE','The phone','prepares a pass.'],['GATE','Entry check:','pass and face']], 9, 22) +
    '<text class="lbl-s" x="1" y="37">THE PREPARED GATE MAKES THE ENTRY CHECK WITHOUT THE INTERNET.</text>',
    'The organizer creates an event. The person gets a ticket. The phone prepares a pass. The prepared gate checks the pass and face without the internet.')
p1 += para('1.2', 'THE FACE CHECK.',
    'The phone changes a face image into numbers. These numbers are the face data. The phone changes these numbers for each event. The pass contains encrypted face data. The gate compares this data with the face at the entrance (figure 2).')
p1 += fig(2, 33, 'One Person and One Pass', '''
    <rect class="box" x="1" y="3" width="48" height="10"/>
    <text class="lbl" x="25" y="9.3" text-anchor="middle">FACE DATA IN THE PASS</text>
    <rect class="box" x="1" y="19" width="48" height="10"/>
    <text class="lbl" x="25" y="25.3" text-anchor="middle">FACE AT THE ENTRANCE</text>
    <polyline class="wa" points="49,8 58,8 58,16 66.5,16"/>
    <polyline class="wa" points="49,24 58,24 58,16 66.5,16"/>
    <rect class="box" x="67" y="9" width="48" height="14"/>
    <text class="lbl" x="91" y="15" text-anchor="middle">GATE COMPARES</text>
    <text class="lbl" x="91" y="20" text-anchor="middle">THE TWO FACES</text>
    <line class="wa" x1="115" y1="16" x2="124.5" y2="16"/>
    <text class="lbl" x="128" y="14">NO SEARCH THROUGH</text>
    <text class="lbl" x="128" y="19">A LIST OF PEOPLE</text>''',
    'The gate compares the face at the entrance with the face data in one pass. It does not search a list of people.')
p1 += para('1.3', 'PASS PROTECTION.',
    'The gate uses a digital signature to examine the source of a pass. The signature also shows changes to the pass. Encryption changes face data into a form that only a prepared gate can read. The gate must also compare the person’s face with the pass.')
p1 += '<div class="lower"><div><div class="tcap">Table 1. Words Used in This Handout</div><table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody>'
for a,b in [('Pass','A digital ticket with encrypted face data.'),('Gate','The device that does the entry check.'),('Offline','Without an internet connection.'),('Server','The computer that keeps ticket records.'),('Prototype','A test system before use at real events.'),('Entry record','A saved record of ticket use.')]:
    p1 += f'<tr><td>{a}</td><td>{b}</td></tr>'
p1 += '</tbody></table></div><div>'
p1 += '<div class="notice"><span class="tag">NOTE</span><p>The server keeps accounts, events, and ticket records. This design does not remove all privacy risks.</p></div>'
p1 += '<div class="card"><div class="bar"><span>KEY POINT</span></div><ol><li><span></span><span>One person.<br>One pass.<br>A local entry check.</span></li></ol></div></div></div>'

p2 = para('2.1', 'WHAT THE TESTS SHOW.',
    'The presentation gives results for software tests. These tests examine ticket rules, repeat requests, pass signatures, ticket reuse, and entry records. They do not show if the face check operates correctly at a real event.')
p2 += fig(3, 40, 'Three Types of Evidence', '''
    <rect class="box" x="1" y="2" width="56" height="30"/>
    <text class="lbl-b" x="29" y="8" text-anchor="middle">SAVED RESULTS</text>
    <text class="lbl" x="29" y="15" text-anchor="middle">Software checks</text>
    <text class="lbl" x="29" y="20" text-anchor="middle">and phone apps</text>
    <text class="lbl" x="29" y="25" text-anchor="middle">have test records.</text>
    <rect class="box" x="62" y="2" width="56" height="30"/>
    <text class="lbl-b" x="90" y="8" text-anchor="middle">WHAT MANAV SAW</text>
    <text class="lbl" x="90" y="15" text-anchor="middle">He later saw</text>
    <text class="lbl" x="90" y="20" text-anchor="middle">the full system</text>
    <text class="lbl" x="90" y="25" text-anchor="middle">operate.</text>
    <rect class="panel" x="123" y="2" width="56" height="30"/>
    <text class="lbl-b" x="151" y="8" text-anchor="middle">NOT MEASURED</text>
    <text class="lbl" x="151" y="15" text-anchor="middle">Face accuracy,</text>
    <text class="lbl" x="151" y="20" text-anchor="middle">fake-face attacks,</text>
    <text class="lbl" x="151" y="25" text-anchor="middle">and queue speed</text>
    <text class="lbl-s" x="1" y="37">MANAV DID NOT KEEP A FULL TEST RECORD OF THE LATER RUN.</text>''',
    'Saved software test records, a later observation without a detailed final record, and performance that the project did not measure.')
p2 += para('2.2', 'THE ENTRY CHECK.',
    'The gate examines the event, time, digital signature, saved cancellations, previous use, and face. It saves ticket use before it shows an entry approval. When the gate connects to the internet again, it sends the entry record to the server.')
p2 += fig(4, 35, 'Demonstration: Expected Results',
    boxes([['PREPARE','Event data saved;','gate offline'],['FIRST SCAN','Expected result:','accept the pass'],['SECOND SCAN','Expected result:','reject the pass'],['RECONNECT','Expected result:','send entry record']], 3, 23),
    'Expected demonstration: prepare and disconnect the gate, accept the first valid scan, reject the same pass, reconnect and send the saved entry record.')
p2 += '<div class="notice"><span class="tag">NOTE</span><p>Figure 4 shows expected results. The demonstration can give different results. An offline gate cannot receive new ticket cancellations.</p></div>'
p2 += para('2.3', 'MORE TESTS BEFORE REAL EVENTS.',
    'More tests must measure correct and incorrect face matches. Tests must also examine attacks with photos, screens, and masks. Other tests must examine queue speed, different users, and entry without a face check.')
p2 += para('2.4', 'THE PROJECT LESSON.',
    'Manav added a website for tickets. This left less time for tests. The next project must have more time for tests and test records.')
p2 += '<div class="lower"><div><h3 style="font:inherit;font-size:10pt;margin:0 0 1mm">THE CONCLUSION.</h3><p style="margin:0">Private Pass can operate in a prepared test system. Tests do not show that it can operate correctly at real events.</p></div><div class="card" style="margin-top:0"><div class="bar"><span>DISCUSSION</span><span>AUDIENCE</span></div><ol><li><span>1</span><span>Which tests have records?</span></li><li><span>2</span><span>What are the privacy risks?</span></li><li><span>3</span><span>What is the next test?</span></li></ol></div></div>'
p2 += '<div class="source">Source: PrivatePass_EPQ Presentation_v4.pptx and its speaker notes. Technical details are simplified for this handout.</div>'

for n, title, body in [(1, 'THE IDEA AND THE TICKET JOURNEY', p1), (2, 'TEST RESULTS AND LIMITS', p2)]:
    html = page(n,title,body)
    # Drawing labels follow the skill's drafting convention.
    html = re.sub(r'(<text\b[^>]*>)(.*?)(</text>)', lambda m:m[1]+m[2].upper()+m[3], html)
    assert not re.search(r'\[[A-Z][A-Z ]+\]', html), 'Unfilled template placeholder'
    (OUT / f'privatepass-handout-{n}.html').write_text(html)
print('Built two audience handout pages.')
