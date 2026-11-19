import os
import json
import re
import hashlib
import pypdf

# 1. Verify existence of primary files
p_000002 = os.path.abspath('backend/storage/sama_veda/certificates/0cef9838bfa6_CSJMU_SAMIKSHA_2026_000002.pdf')
p_inc_71 = os.path.abspath(r'C:\Users\harsh\Downloads\SAMIKSHA_INCENTIVE_CERT_71.pdf')
p_inc_rem = os.path.abspath(r'C:\Users\harsh\Downloads\SAMIKSHA_INCENTIVE_CERT_71_removed.pdf')

print("1. Checking Source File Existence:")
for p in [p_000002, p_inc_71, p_inc_rem]:
    exists = os.path.exists(p)
    sz = os.path.getsize(p) if exists else 0
    print(f"  - {os.path.basename(p)}: Exists={exists}, Size={sz:,} bytes")

# SHA-256 of 000002
with open(p_000002, 'rb') as f:
    h_000002 = hashlib.sha256(f.read()).hexdigest()
print(f"  - 000002 SHA-256: {h_000002}")
expected_h = '48359a34d7c538c927e10c20b4fe2eab46e8a27e917dfc85e5ff3df2e0c1baa4'
print(f"    Matches audit log SHA-256? {h_000002 == expected_h}")

# Verify 000002 PDF text
r_02 = pypdf.PdfReader(p_000002)
t_02 = r_02.pages[0].extract_text()
recip_02 = 'Dr. Harshit Gupta' if 'Dr. Harshit Gupta' in t_02 else 'UNKNOWN'
cert_02 = 'CSJMU/SAMIKSHA/2026/000002' if 'CSJMU/SAMIKSHA/2026/000002' in t_02 else 'UNKNOWN'
title_02 = 'XYZ' if 'XYZ' in t_02 else 'UNKNOWN'
print(f"  - 000002 Extracted: CertNo={cert_02}, Recipient={recip_02}, Title={title_02}")

# Load deduplicated incentive inventory from previous phase
with open('scratch/deduped_incentive_inventory.json', encoding='utf-8') as f:
    inc_records = json.load(f)

print(f"\n2. Loaded {len(inc_records)} incentive records from deduped inventory.")

# Add 000002 to create complete historical list
cert_02_record = {
    'cert_no': 'CSJMU/SAMIKSHA/2026/000002',
    'recipient': 'Dr. Harshit Gupta',
    'title': 'XYZ',
    'certificate_type': 'SCHOLARLY_FELICITATION',
    'amount': None,
    'citation': 'Volume 2, Issue 3 (July - September 2026)',
    'qr_url': 'http://localhost:8000/verify/8e17212587fa4b6b8b3e4a8f20d21342',
    'token': '8e17212587fa4b6b8b3e4a8f20d21342',
    'sha256': h_000002,
    'source_pdf': 'backend/storage/sama_veda/certificates/0cef9838bfa6_CSJMU_SAMIKSHA_2026_000002.pdf',
    'recovery_source': 'STORAGE_AUDIT_LOG_AND_VECTOR_PDF'
}

all_75 = [cert_02_record]

for r in inc_records:
    # Determine cert type
    ctype = 'INCENTIVE_AWARD'
    if 'Appreciation' in r.get('amount', ''):
        ctype = 'APPRECIATION_AWARD'
    
    all_75.append({
        'cert_no': r['cert_no'],
        'recipient': r['recipient'],
        'title': r['title'],
        'certificate_type': ctype,
        'amount': r['amount'] if ctype == 'INCENTIVE_AWARD' else None,
        'citation': r['citation'] or 'Volume 2, Issue 3 (July - September 2026)',
        'qr_url': r['qr_url'],
        'token': r['token'],
        'sha256': None, # Master multi-page PDF
        'source_pdf': r['source_pdf'],
        'page': r.get('page'),
        'recovery_source': 'DISTRIBUTION_PRINT_BATCH_VECTOR_STREAM'
    })

print(f"\n3. Total Historical Inventory Count: {len(all_75)}")

# Verification checks
tokens = [x['token'] for x in all_75]
cert_nos = [x['cert_no'] for x in all_75]

print("4. Reconciliation Checks:")
print(f"  - Exactly 75 records: {len(all_75) == 75} ({len(all_75)})")
print(f"  - Exactly 75 unique tokens: {len(set(tokens)) == 75} ({len(set(tokens))})")
print(f"  - Exactly 75 unique cert numbers: {len(set(cert_nos)) == 75} ({len(set(cert_nos))})")

# Check all tokens are 32-char hex
hex_valid = all(re.match(r'^[0-9a-fA-F]{32}$', t) for t in tokens)
print(f"  - All tokens are valid 32-char hex: {hex_valid}")

# Check serial numbers range
nums = [int(x.split('/')[-1]) for x in cert_nos]
print(f"  - Serial numbers: min={min(nums)}, max={max(nums)}")
missing_nums = [n for n in range(min(nums), max(nums)+1) if n not in nums]
print(f"  - Missing numbers in sequence: {missing_nums}")
print(f"  - Confirm 45 and 73 are excluded (not fabricated): {45 in missing_nums and 73 in missing_nums}")
print(f"  - Confirm 1, 3, 4, 5 are excluded (belong to other records): {[1, 3, 4, 5] == [n for n in missing_nums if n < 6]}")

# Write normalized dataset
os.makedirs('scratch/normalized_recovery', exist_ok=True)
norm_path = 'scratch/normalized_recovery/historical_75_certificates.json'
with open(norm_path, 'w', encoding='utf-8') as f:
    json.dump(all_75, f, indent=2, ensure_ascii=False)

print(f"\nSaved normalized recovery dataset to: {norm_path}")
