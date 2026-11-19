import zlib
from pathlib import Path
from pypdf import PdfReader

cert_dir = Path('backend/storage/sama_veda/certificates')
for pdf_path in sorted(cert_dir.glob('*.pdf')):
    print('='*60)
    print(f'File: {pdf_path.name}')
    reader = PdfReader(str(pdf_path))
    for page_idx, page in enumerate(reader.pages):
        contents = page.get_contents()
        if contents:
            data = contents.get_data().decode('latin1', errors='ignore')
            # Check for urls, verify, http
            for line in data.split('\n'):
                if any(k in line.lower() for k in ['http', 'verify', 'sama', 'csjmu', 'tok']):
                    print(f'  [P{page_idx}] {line[:120]}')
