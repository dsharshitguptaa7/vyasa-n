import os, sys
from pathlib import Path
from pypdf import PdfReader
import openpyxl

dl_dir = Path(r'C:\Users\harsh\Downloads')

# 1. Inspect VOLUME 2 ISSUE 3 CERTIFICATES.pdf
v2i3_pdf = dl_dir / 'VOLUME 2 ISSUE 3 CERTIFICATES.pdf'
if v2i3_pdf.exists():
    r = PdfReader(str(v2i3_pdf))
    print(f'=== VOLUME 2 ISSUE 3 CERTIFICATES.pdf ===')
    print(f'Total pages: {len(r.pages)}')
    for pno in range(min(5, len(r.pages))):
        print(f'--- PAGE {pno+1} ---')
        txt = r.pages[pno].extract_text() or ''
        lines = [l.strip() for l in txt.split('\n') if l.strip()]
        for l in lines[:10]:
            print(' ', l)

# 2. Inspect SAMIKSHA_INCENTIVE_CERT_71.pdf
inc_pdf = dl_dir / 'SAMIKSHA_INCENTIVE_CERT_71.pdf'
if inc_pdf.exists():
    r2 = PdfReader(str(inc_pdf))
    print(f'\n=== SAMIKSHA_INCENTIVE_CERT_71.pdf ===')
    print(f'Total pages: {len(r2.pages)}')
    for pno in range(min(5, len(r2.pages))):
        print(f'--- PAGE {pno+1} ---')
        txt = r2.pages[pno].extract_text() or ''
        lines = [l.strip() for l in txt.split('\n') if l.strip()]
        for l in lines[:10]:
            print(' ', l)

# 3. Inspect CERTIFICATES LIST.xlsx
xlsx_path = dl_dir / 'CERTIFICATES LIST.xlsx'
if xlsx_path.exists():
    wb = openpyxl.load_workbook(str(xlsx_path), data_only=True)
    print(f'\n=== CERTIFICATES LIST.xlsx ===')
    print(f'Sheets: {wb.sheetnames}')
    for sheetname in wb.sheetnames:
        sheet = wb[sheetname]
        print(f'Sheet {sheetname}: {sheet.max_row} rows, {sheet.max_column} cols')
        rows = list(sheet.iter_rows(values_only=True))
        if rows:
            print('  Header:', rows[0])
            for r in rows[1:6]:
                print('  Row:', r)
