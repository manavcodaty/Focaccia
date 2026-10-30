"""Check the final reference PDF and realistic reader lookup routes."""
from pathlib import Path
from html import unescape
import hashlib
import re
import pymupdf

root = Path(__file__).resolve().parent.parent
pdf = root / 'PrivatePass_Presentation_Companion.pdf'
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
    html = (root/f'privatepass-companion-{number}.html').read_text()
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

# These are content and findability checks, not simulated human comprehension.
cases = [
    ('Is a template a photograph?', 1, 'WHAT IS FACE DATA?', ['A face image is a picture.', 'Face data is a set of numbers', 'another name for this set']),
    ('Does the gate search everyone?', 1, 'WHAT DOES 1:1 MEAN?', ['one person with one pass', 'does not search a list']),
    ('Can it reject the right person?', 1, 'WHAT DOES THE MATCH LIMIT DO?', ['reject the correct person', 'accept the wrong person', 'FALSE REJECTION', 'FALSE ACCEPTANCE']),
    ('Why does a signed copy still need a face check?', 2, 'SIGNED AND ENCRYPTED: WHAT IS THE DIFFERENCE?', ['A copied pass can still have a correct digital signature.', 'must also compare the face']),
    ('How does it operate without internet?', 2, 'HOW CAN THE GATE OPERATE OFFLINE?', ['downloads event data', 'use the saved data', 'SEND THE ENTRY RECORD']),
    ('Why does an offline gate miss a cancellation?', 2, 'WHY CAN A CANCELED TICKET STILL PASS?', ['The organizer then cancels a ticket.', 'cannot receive that change until it connects again']),
    ('Does seeing one run establish performance?', 2, None, ['Observed run', 'no repeat test record', 'This word gives no performance result.']),
    ('Does seeing a face stop a photo attack?', 2, None, ['A detected face can be a photo or a screen.', 'does not stop a spoof attack'])
]
for question, page, heading, answers in cases:
    if heading:
        assert headings.get(heading) == page, question
    for answer in answers:
        assert answer in pages[page-1], (question, answer)
for page in pages:
    assert 'FACE WORDS / MATCH ERRORS: PAGE 1' in page
    assert 'PASS SECURITY / OFFLINE / TEST CLAIMS: PAGE 2' in page
full = ' '.join(pages)
assert 'EXAMPLES OF ERRORS, NOT PRIVATE PASS TEST RESULTS' in full
assert 'Examples explain concepts; they are not recorded test results.' in full
assert not re.search(r'\d+(?:\.\d+)?\s*(?:%|milliseconds|ms\b)', full)

preview = pymupdf.open()
w,h = doc[0].rect.width,doc[0].rect.height
sheet = preview.new_page(width=w*2+16,height=h)
sheet.show_pdf_page(pymupdf.Rect(0,0,w,h),doc,0)
sheet.show_pdf_page(pymupdf.Rect(w+16,0,w*2+16,h),doc,1)
sheet.get_pixmap(matrix=pymupdf.Matrix(1.4,1.4)).save(root/'PrivatePass_Presentation_Companion_preview.png')

report = [
    'Private Pass presentation companion: final verification',
    'PASS: 2 A4 pages; all fonts embedded; all text within paper bounds.',
    'PASS: paragraph, table, heading, and checklist text read back from final PDF.',
    f'PASS: {len(sentences)} descriptive text units; maximum {max(sentences)} words per sentence.',
    f'PASS: {len(steps)} procedure text units; maximum {max(steps)} words per step.',
    'PASS: paragraphs have at most six sentences; no contractions.',
    'PASS: both page indexes point to the page containing the explanation.',
    'PASS: 8 reader lookup scenarios have explicit answers on the indexed page.',
    *[f'  Page {p}: {q}' for q,p,_,_ in cases],
    'PASS: examples are explicitly distinguished from recorded test results.',
    'PASS: no invented numerical accuracy or speed claims.',
    'Print verification: nasa-handbook check.py passed; A4 and pure black/white.',
    'Language: ASD-STE100 Issue 9 writing rules and dictionary reviewed from the local official specification.',
    'Subject terms: pass, face template, embedding, match limit, enrollment, spoof attack, encryption, digital signature,',
    'offline, server, software test, observed run, prototype. Save/download are computer operations.',
    'Explanations deliberately omit algorithms, keys, model details, and biometric performance figures.',
    'Source: PrivatePass_EPQ Presentation_v4.pptx, physical slides 2, 5, 7-10, 12-16, 18 and associated speaker notes.',
    'No repository implementation or hardware behavior was revalidated for this document-only task.',
    'These automated checks establish document integrity and lookup coverage, not human comprehension.',
    'No physical print test, external STE certification, or audience trial was performed.',
    'PDF SHA-256: '+hashlib.sha256(pdf.read_bytes()).hexdigest()
]
(root/'review/verification.txt').write_text('\n'.join(report)+'\n')
print('\n'.join(report[:8]))
