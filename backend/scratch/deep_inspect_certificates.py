import os, sys, re
from pathlib import Path
from pypdf import PdfReader

dl_dir = Path(r'C:\Users\harsh\Downloads')

def inspect_incentive_71():
    pdf_path = dl_dir / 'SAMIKSHA_INCENTIVE_CERT_71.pdf'
    r = PdfReader(str(pdf_path))
    print(f'=== SAMIKSHA_INCENTIVE_CERT_71.pdf ({len(r.pages)} pages) ===')
    cert_numbers = []
    recipients = []
    for idx, p in enumerate(r.pages):
        txt = p.extract_text() or ''
        m_cert = re.search(r'CSJMU/SAMIKSHA/2026/\d+', txt)
        cert_no = m_cert.group(0) if m_cert else 'UNKNOWN'
        cert_numbers.append(cert_no)
        
        # recipient usually follows "proudly awarded to"
        lines = [l.strip() for l in txt.split('\n') if l.strip()]
        recip = 'UNKNOWN'
        for i, l in enumerate(lines):
            if 'proudly awarded to' in l.lower() or 'proudly conferred upon' in l.lower():
                if i + 1 < len(lines):
                    recip = lines[i+1]
                break
        recipients.append((idx+1, cert_no, recip))
    
    print(f'Total certificates extracted: {len(cert_numbers)}')
    print(f'Unique cert numbers: {len(set(cert_numbers))}')
    sorted_certs = sorted(list(set(cert_numbers)))
    print(f'Cert numbers range: {sorted_certs[0]} to {sorted_certs[-1]}')
    for page_no, c_no, r_name in recipients[:15]:
        print(f'  Page {page_no:2d}: {c_no} | Recipient: {r_name}')
    print('  ...')
    for page_no, c_no, r_name in recipients[-15:]:
        print(f'  Page {page_no:2d}: {c_no} | Recipient: {r_name}')

def inspect_v2i3_certificates():
    pdf_path = dl_dir / 'VOLUME 2 ISSUE 3 CERTIFICATES.pdf'
    r = PdfReader(str(pdf_path))
    print(f'\n=== VOLUME 2 ISSUE 3 CERTIFICATES.pdf ({len(r.pages)} pages) ===')
    for idx in range(min(10, len(r.pages))):
        p = r.pages[idx]
        txt = p.extract_text() or ''
        lines = [l.strip() for l in txt.split('\n') if l.strip()]
        print(f'--- PAGE {idx+1} ---')
        for l in lines:
            print(' ', l)

inspect_incentive_71()
inspect_v2i3_certificates()
