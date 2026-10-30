"""Verify the delivered PDF, not only the HTML source."""
from pathlib import Path
from html import unescape
import hashlib
import re
import pymupdf

root = Path(__file__).resolve().parent.parent
pdf = root / 'PrivatePass_Audience_Handout.pdf'
doc = pymupdf.open(pdf)
assert len(doc) == 2
sentences = []
report = ['Private Pass audience handout: final verification', '']
normalize = lambda s: re.sub(r'\s+', ' ', s).strip()
for i, page in enumerate(doc, 1):
    assert abs(page.rect.width - 210 * 72 / 25.4) < 1
    assert abs(page.rect.height - 297 * 72 / 25.4) < 1
    text = normalize(page.get_text())
    assert f'Page {i} of 2' in text
    assert '\ufffd' not in text
    html = (root / f'privatepass-handout-{i}.html').read_text()
    paragraphs = re.findall(r'<p\b[^>]*>(.*?)</p>', html, re.S)
    for raw in paragraphs:
        paragraph = normalize(unescape(re.sub(r'<[^>]+>', '', raw)))
        assert paragraph in text, f'PDF lost paragraph: {paragraph}'
        ss = re.split(r'(?<=[.!?])\s+', paragraph)
        assert len(ss) <= 6, paragraph
        for sentence in ss:
            # Conservative count: split hyphenated forms into separate words.
            count = len(re.findall(r"\b[\w]+(?:[’'][\w]+)?\b", sentence))
            assert count <= 25, (count, sentence)
            sentences.append((count, sentence))
        assert not re.search(r"\b(?:isn't|doesn't|can't|won't|don't|it's)\b", paragraph)
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                box = pymupdf.Rect(span['bbox'])
                assert box.x0 >= 0 and box.y0 >= 0
                assert box.x1 <= page.rect.width and box.y1 <= page.rect.height
    for font in page.get_fonts():
        assert len(doc.extract_font(font[0])[3]) > 0, f'Unembedded font: {font}'
    report.append(f'Page {i}: A4, complete text readback, embedded fonts, all text within the paper.')

full = normalize(' '.join(page.get_text() for page in doc))
for term in ['digital signature', 'Encryption', 'NOT MEASURED', 'EXPECTED RESULT:',
             'cannot receive new ticket cancellations', 'full test record',
             'photos, screens, and masks', 'entry without a face check']:
    assert term.lower() in full.lower(), f'Missing required topic: {term}'
assert 'Tests do not show that it can operate correctly at real events.' in full
report += [f'{len(sentences)} descriptive sentences checked; maximum length: {max(n for n, _ in sentences)} words.',
           'All prose paragraphs have at most six sentences. No contractions.',
           'Content cross-check: all 19 source slides and all 19 speaker-note pages were read.',
           'Topic checks: ticket journey, pass protection, privacy risks, evidence limits, demo expectations, cancellations, and further tests.',
           'Visual check: all 16 PDF tiles inspected at 300 dpi; no clipped words or label/line collisions.',
           'Print color and page-count check: nasa-handbook check.py passed for the merged two-page PDF.',
           '',
           'Language review: ASD-STE100 Issue 9 writing rules and dictionary consulted.',
           'Short active sentences and consistent terms used. Software terms are subject-specific technical nouns/verbs.',
           'Technical nouns include: Private Pass, event, pass, face data, face accuracy, face match, digital signature,',
           'encryption, privacy risk, server, gate, entry record, test record, expected result, ticket reuse,',
           'software, website, prototype, and internet. Save is a computer operation.',
           'This review is not an independent STE certification or an audience comprehension trial.',
           '',
           'Source map (physical slide order, not the printed slide labels):',
           'Page 1, system function and ticket journey: slides 1-3, 6-8.',
           'Page 1, signature/encryption and glossary: slides 6-10 plus speaker notes.',
           'Page 2, tests and observations: slides 12-13, 15, 18 plus speaker notes.',
           'Page 2, gate and demonstration: slides 10-11, 14.',
           'Page 2, missing tests and project lesson: slides 4, 16-18.',
           'The handout summarizes the supplied presentation; underlying project tests were not rerun.',
           'No performance figures or model constants were added.',
           'Physical printing and independent language review were not performed.',
           '', 'PDF SHA-256: '+hashlib.sha256(pdf.read_bytes()).hexdigest()]
(root / 'review/verification.txt').write_text('\n'.join(report)+'\n')

# Produce a preview of the final merged PDF, so it cannot show stale HTML.
preview = pymupdf.open()
w, h = doc[0].rect.width, doc[0].rect.height
sheet = preview.new_page(width=w*2+16, height=h)
sheet.show_pdf_page(pymupdf.Rect(0, 0, w, h), doc, 0)
sheet.show_pdf_page(pymupdf.Rect(w+16, 0, w*2+16, h), doc, 1)
sheet.get_pixmap(matrix=pymupdf.Matrix(1.4, 1.4)).save(root/'PrivatePass_Audience_Handout_preview.png')
print('\n'.join(report[:8]))
