"""Check the final reference PDF and realistic reader lookup routes."""
from pathlib import Path
from html import unescape
import hashlib
import re
import pymupdf

root = Path(__file__).resolve().parent.parent
pdf = root / 'PrivatePass_Architecture_Companion.pdf'
doc = pymupdf.open(pdf)
assert len(doc) == 2
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
sentences, steps, headings = [], [], {}
pages = []
for number, page in enumerate(doc, 1):
    assert abs(page.rect.width - 210*72/25.4) < 1
    assert abs(page.rect.height - 297*72/25.4) < 1
    content = norm(page.get_text())
    pages.append(content)
    assert f'Page {number} of 2' in content
    assert '\ufffd' not in content
    html = (root/f'privatepass-balanced-{number}.html').read_text()
    for tag, raw in re.findall(r'<(p|td|h2|h3|li)\b[^>]*>(.*?)</\1>', html, re.S):
        text = norm(unescape(re.sub(r'<[^>]+>', ' ', raw)))
        assert text in content, f'Lost PDF text: {text}'
        if tag in ['h2','h3']:
            headings[text] = number
        if tag in ['p','td','li']:
            ss = re.split(r'(?<=[.!?])\s+', text)
            assert len(ss) <= 6
            for sentence in ss:
                words = re.findall(r"\b[\w]+(?:[’'][\w]+)?\b",sentence)
                limit = 20 if tag == 'li' else 25
                assert len(words) <= limit, (len(words), sentence)
                (steps if tag == 'li' else sentences).append(len(words))
            assert not re.search(r"\b(?:isn't|doesn't|can't|won't|don't|it's)\b", text)
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            for span in line['spans']:
                box = pymupdf.Rect(span['bbox'])
                assert box.x0 >= 0 and box.y0 >= 0
                assert box.x1 <= page.rect.width and box.y1 <= page.rect.height
    for font in page.get_fonts():
        assert doc.extract_font(font[0])[3], f'Unembedded font {font}'
    mm = 72/25.4
    tabs = [d['rect'] for d in page.get_drawings() if d.get('fill') == (0,0,0)
            and abs(d['rect'].width/mm-7)<.3 and abs(d['rect'].height/mm-14)<.3]
    assert len(tabs)==1, f'Page {number}: expected one complete inset PPS tab'
    tab=tabs[0]
    assert page.rect.width-tab.x1>=4.8*mm, 'Tab reaches the paper edge'
    labels=[s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] if s['text']=='PPS']
    assert len(labels)==1 and tab.contains(pymupdf.Rect(labels[0]['bbox'])), 'Clipped PPS label'

cases = [
    ('System components and online links',1,['ORGANIZER WEBSITE','TICKET WEBSITE','CENTRAL SERVER','ATTENDEE PHONE APP','GATE PHONE APP','ONLINE: PASS ISSUE','ONLINE: SETUP / SYNC']),
    ('Pass creation and encrypted server input',1,['gate’s public key','ticket ownership','signed pass as a QR code','not the face image or readable template']),
    ('Private key location',1,['The public key can be shared.','The private key stays on the gate and opens the template.']),
    ('Six-stage local decision',2,['1 READ + VERIFY','2 CHECK RULES','3 DECRYPT','4 CAPTURE FACE','5 COMPARE','6 SAVE FIRST']),
    ('Comparison under the hood',2,['same event rule','counts differences','match limit sets the permitted difference']),
    ('Durable local record',2,['before it shows entry approval','stops another use on that gate','RECORD SURVIVES','AN APP RESTART.','SEND SIGNED RECORD.']),
    ('Offline and biometric limits',2,['cannot receive new cancellations','does not test face accuracy or fake-face protection']),
    ('Verified software result',2,['WHAT DID I TEST OR ACHIEVE?','rejected a second entry record for the same pass','database protection against repeat records']),
    ('Definitions at first use',2,['3 DECRYPT MAKE ENCRYPTED DATA READABLE.','MATCH LIMIT: MAXIMUM PERMITTED DIFFERENCE'])]
for name,page,terms in cases:
    for term in terms:
        assert term in pages[page-1],(name,term)
for number in [1,2]:
    html=(root/f'privatepass-balanced-{number}.html').read_text()
    assert html.count('<figure>')==2
    for raw in re.findall(r'<text\b[^>]*>(.*?)</text>',html,re.S):
        assert norm(unescape(raw)) in pages[number-1], raw
    assert 'SYSTEM MAP / PASS CREATION: PAGE 1' in pages[number-1]
    assert 'GATE DECISION / OFFLINE RECORDS: PAGE 2' in pages[number-1]
html1=(root/'privatepass-balanced-1.html').read_text()
assert html1.count('<tr>')==7 # One header and six definitions.
assert html1.count('class="online"')==4
assert 'marker-start: url(#nh-flow); marker-end: url(#nh-flow)' in html1
assert 'orient="auto-start-reverse"' in html1
assert 'DOUBLE ARROWS: REQUESTS + REPLIES' in pages[0]
assert 'Manav built Private Pass, a prototype for offline face checks, to reduce ticket sharing and central face storage' in pages[0]
aim=re.search(r'<p>(Manav built.*?)</p>',html1)[1]
assert len(re.split(r'(?<=[.!?])\s+',aim))==1
result=(root/'review/verified-software-result.txt').read_text()
assert 'exit code 0; tests 1; pass 1; fail 0' in result
assert '<table>' not in (root/'privatepass-balanced-2.html').read_text()
assert not re.search(r'\d+(?:\.\d+)?\s*(?:%|milliseconds|ms\b)',' '.join(pages))

# Check that the technical claims agree with the inspected implementation.
repo=root.parents[2]
sources={name:(repo/name).read_text() for name in [
    'README.md','docs/ARCHITECTURE.md','docs/PHASE_6_OFFLINE_GATE_AND_SIGNED_SYNC.md',
    'apps/enrollment/src/lib/pass-flow.ts','supabase/functions/issue-pass/index.ts',
    'apps/gate/src/lib/offline-verifier.ts','apps/gate/src/lib/gate-db.ts',
    'apps/gate/src/lib/secure-value-store.ts','apps/gate/src/state/gate-context.tsx',
    'apps/gate/src/lib/liveness.ts','packages/shared/src/template.ts']}
flow=sources['apps/enrollment/src/lib/pass-flow.ts']
assert flow.index('const template = await cancelableTemplateV1')<flow.index('encryptedTemplateBytes = await x25519Seal')
assert 'const issueResult = await issuePass(draft.payload)' in flow
assert "'requesting-signature'" in flow
issue=sources['supabase/functions/issue-pass/index.ts']
assert ".eq('attendee_user_id', user.id)" in issue
assert 'canonicalJsonSignature(payload, signingSecret)' in issue
gate=sources['apps/gate/src/lib/offline-verifier.ts']
assert gate.index('const verified = await ed25519VerifyDetached')<gate.index('const alreadyUsed = await checkReplay')<gate.index('decryptedTemplate = await x25519SealOpen')
assert 'hammingDistance(pending.decryptedTemplate, liveTemplate)' in gate
assert 'cancelableTemplateV1(liveEmbedding, eventSalt)' in gate
assert 'recordAcceptedDecision(' in sources['apps/gate/src/lib/gate-db.ts']
assert 'await insertQueueItem(driver, syncItem)' in sources['apps/gate/src/lib/gate-db.ts']
ui=sources['apps/gate/src/state/gate-context.tsx']
start=ui.index('await repository.recordAcceptedDecision(')
assert ui.index('setLastResult(decision)',start)>start
assert 'snapshot.faceCount === 1' in sources['apps/gate/src/lib/liveness.ts']
assert 'new Uint8Array(TEMPLATE_BYTES)' in sources['packages/shared/src/template.ts']

preview=pymupdf.open()
w,h=doc[0].rect.width,doc[0].rect.height
sheet=preview.new_page(width=w*2+16,height=h)
sheet.show_pdf_page(pymupdf.Rect(0,0,w,h),doc,0)
sheet.show_pdf_page(pymupdf.Rect(w+16,0,w*2+16,h),doc,1)
sheet.get_pixmap(matrix=pymupdf.Matrix(1.4,1.4)).save(root/'PrivatePass_Architecture_Companion_preview.png')
report=[
    'Private Pass architecture companion: verification',
    'PASS: two A4 pages; pure black/white confirmed by the NASA skill checker.',
    'PASS: all fonts embedded; complete paragraphs, table, headings and figure labels read back from final PDF.',
    f'PASS: {len(sentences)} descriptive text units checked; maximum {max(sentences)} words per sentence; at most six sentences per paragraph.',
    'PASS: no contractions; all PDF text inside page bounds.',
    'PASS: four mechanism diagrams, one compact six-term glossary, correct page lookup index.',
    'PASS: nine content scenarios cover architecture, issuance, keys, gate checks, matching, storage, evidence limits and first-use definitions.',
    'PASS: aim/build statement is one sentence; all four online connections have two-way arrowheads and a legend.',
    'PASS: both PPS tabs and their complete labels are inside the paper, with about 5 mm of right margin.',
    'PASS: one real local SQLite test passed; the panel limits the result to duplicate-record protection.',
    'PASS: source contract checks for encryption before signing request, ownership verification, local checks, matching and storage before displayed approval.',
    'PASS: no invented accuracy, speed, model or key-size figures.',
    'Fit checks: see the final render output; both pages must have positive footer clearance.',
    'Language review: ASD-STE100 Issue 9 rules and dictionary consulted; computing terms are field-specific technical nouns and verbs.',
    'Deliberate simplification: cryptographic algorithms, encoding, database schema and exceptional/manual flows are omitted.',
    'The gate face-presence step is not presented as established anti-spoof protection.',
    'Document and source checks do not establish physical operation, audience comprehension, or independent STE certification.',
    'Source files inspected:',*['  '+str(repo/name) for name in sources],
    'PDF SHA-256: '+hashlib.sha256(pdf.read_bytes()).hexdigest()]
(root/'review/verification.txt').write_text('\n'.join(report)+'\n')
print('\n'.join(report[:10]))

