import pypdf
import re
import json

with open('scratch/all_71_extracted.json') as f:
    qr_data = {item['page']: item['qr_url'] for item in json.load(f)}

reader = pypdf.PdfReader(r'C:\Users\harsh\Downloads\SAMIKSHA_INCENTIVE_CERT_71.pdf')
inventory = []

for idx, page in enumerate(reader.pages):
    p_num = idx + 1
    text = page.extract_text() or ''
    cert_m = re.search(r'CSJMU/SAMIKSHA/2026/(\d+)', text)
    cert_no = f'CSJMU/SAMIKSHA/2026/{cert_m.group(1)}' if cert_m else f'PAGE_{p_num}'
    
    # Recipient
    recip = ''
    recip_m = re.search(r'proudly (?:awarded to|conferred upon)\s*\n\s*(.*?)\s*\n\s*(?:in recognition|Scopus)', text, re.DOTALL)
    if recip_m:
        recip = recip_m.group(1).strip()
        
    # Title
    title = ''
    title_m = re.search(r'(?:for the work titled:|scholarly research publication in:)\s*\n(.*?)\nThe University', text, re.DOTALL)
    if title_m:
        title = ' '.join(title_m.group(1).replace('“','').replace('”','').replace('"','').split())
        
    # Sanctioned amount
    amt = ''
    amt_m = re.search(r'SANCTIONED INCENTIVE AWARD\s*\n\s*(INR\s*[\d,]+)', text)
    if amt_m:
        amt = amt_m.group(1).strip()
        
    # Citation / Issue
    citation = ''
    cit_m = re.search(r'RESEARCH BULLETIN CITATION\s*\n\s*(Volume \d+,\s*Issue \d+.*?)\s*\n', text)
    if cit_m:
        citation = cit_m.group(1).strip()
        
    qr_url = qr_data.get(p_num, '')
    token = qr_url.split('/')[-1] if qr_url else ''
    
    inventory.append({
        'page': p_num,
        'cert_no': cert_no,
        'recipient': recip,
        'title': title,
        'amount': amt,
        'citation': citation,
        'qr_url': qr_url,
        'token': token,
        'source_pdf': 'SAMIKSHA_INCENTIVE_CERT_71.pdf'
    })

# Also extract the 3 missing certs from SAMIKSHA_INCENTIVE_CERT_71_removed.pdf
with open('scratch/removed_extracted.json') as f:
    rem_qr = {item['page']: item for item in json.load(f)}

reader_rem = pypdf.PdfReader(r'C:\Users\harsh\Downloads\SAMIKSHA_INCENTIVE_CERT_71_removed.pdf')
for p_num, rem_item in rem_qr.items():
    idx = int(p_num) - 1
    page = reader_rem.pages[idx]
    text = page.extract_text() or ''
    cert_m = re.search(r'CSJMU/SAMIKSHA/2026/(\d+)', text)
    cert_no = f'CSJMU/SAMIKSHA/2026/{cert_m.group(1)}' if cert_m else f'PAGE_{p_num}'
    
    recip = ''
    recip_m = re.search(r'proudly (?:awarded to|conferred upon)\s*\n\s*(.*?)\s*\n\s*(?:in recognition|Scopus)', text, re.DOTALL)
    if recip_m:
        recip = recip_m.group(1).strip()
        
    title = ''
    title_m = re.search(r'(?:for the work titled:|scholarly research publication in:)\s*\n(.*?)\nThe University', text, re.DOTALL)
    if title_m:
        title = ' '.join(title_m.group(1).replace('“','').replace('”','').replace('"','').split())
            
    amt = ''
    amt_m = re.search(r'SANCTIONED INCENTIVE AWARD\s*\n\s*(INR\s*[\d,]+)', text)
    if amt_m:
        amt = amt_m.group(1).strip()
    else:
        amt = 'N/A (Appreciation Certificate)'
        
    citation = ''
    cit_m = re.search(r'RESEARCH (?:BULLETIN )?CITATION\s*\n\s*(Volume \d+,\s*Issue \d+.*?)\s*\n', text)
    if cit_m:
        citation = cit_m.group(1).strip()
        
    qr_url = rem_item['qr_url']
    token = qr_url.split('/')[-1] if qr_url else ''
    
    inventory.append({
        'page': int(p_num),
        'cert_no': cert_no,
        'recipient': recip,
        'title': title,
        'amount': amt,
        'citation': citation,
        'qr_url': qr_url,
        'token': token,
        'source_pdf': 'SAMIKSHA_INCENTIVE_CERT_71_removed.pdf'
    })

# Deduplicate
unique = {}
for item in inventory:
    c = item['cert_no']
    if c not in unique or (unique[c]['title'] == '' and item['title'] != ''):
        unique[c] = item

sorted_certs = sorted(unique.values(), key=lambda x: int(x['cert_no'].split('/')[-1]))

with open('scratch/deduped_incentive_inventory.json', 'w', encoding='utf-8') as f:
    json.dump(sorted_certs, f, indent=2, ensure_ascii=False)

print(f"Total deduplicated records: {len(sorted_certs)}")
for num in ['000019', '000036', '000074']:
    target = f'CSJMU/SAMIKSHA/2026/{num}'
    c_rec = next((x for x in sorted_certs if x['cert_no'] == target), None)
    print(c_rec)
