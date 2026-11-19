import openpyxl
from pathlib import Path

dl_dir = Path(r'C:\Users\harsh\Downloads')
xlsx = dl_dir / 'CERTIFICATES LIST.xlsx'
wb = openpyxl.load_workbook(str(xlsx), data_only=True)
for sheet in wb.sheetnames:
    ws = wb[sheet]
    print(f'Sheet {sheet}:')
    for r_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
        row_str = ' | '.join(str(c) for c in row if c is not None)
        if any(w in row_str for w in ['000045', '000073', '000019', '000036', '000074', '000078', '000081']):
            print(f'  Row {r_idx}: {row_str[:150]}')
