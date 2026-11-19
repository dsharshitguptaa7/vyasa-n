import re
import numpy as np
from pypdf import PdfReader

r = PdfReader(r'C:\Users\harsh\Downloads\SAMIKSHA_INCENTIVE_CERT_71.pdf')
page1 = r.pages[0]
content = page1.get_contents().get_data().decode('latin1')
rects = re.findall(r'n\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+re\s+f\*', content)
print('Total rects in page 1:', len(rects))
h_vals = set(float(r[3]) for r in rects)
print('Height values:', h_vals)
