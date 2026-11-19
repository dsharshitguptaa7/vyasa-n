from pypdf import PdfReader
r = PdfReader(r'C:\Users\harsh\Downloads\SAMIKSHA_INCENTIVE_CERT_71.pdf')
p = r.pages[0]
print('Resources keys:', p['/Resources'].keys())
if '/XObject' in p['/Resources']:
    print('XObjects:', p['/Resources']['/XObject'].keys())
    for k, v in p['/Resources']['/XObject'].items():
        obj = v.get_object()
        print(f"  {k}: Subtype={obj.get('/Subtype')}, Width={obj.get('/Width')}, Height={obj.get('/Height')}")
