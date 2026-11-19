file_path = "frontend/src/admin/types/sama.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update IssueCertificatePayload
old_issue = '''  certificate_number?: string;
  bulletin_id?: string | null;'''

new_issue = '''  certificate_number?: string;
  verification_identifier?: string;
  verification_token?: string;
  bulletin_id?: string | null;'''

# 2. Update CertificatePreviewPayload
old_prev = '''  certificate_number?: string;
  config_overrides?: Record<string, any>;'''

new_prev = '''  certificate_number?: string;
  verification_identifier?: string;
  verification_token?: string;
  config_overrides?: Record<string, any>;'''

# 3. Update BulkCertificateItemInput
old_bulk = '''  publication_details?: Record<string, any> | null;
  incentive_details?: Record<string, any> | null;
}'''

new_bulk = '''  publication_details?: Record<string, any> | null;
  incentive_details?: Record<string, any> | null;
  certificate_number?: string;
  verification_identifier?: string;
  verification_token?: string;
}'''

content_norm = content.replace("\r\n", "\n")
assert old_issue in content_norm, "old_issue not found"
assert old_prev in content_norm, "old_prev not found"
assert old_bulk in content_norm, "old_bulk not found"

content_norm = content_norm.replace(old_issue, new_issue, 1)
content_norm = content_norm.replace(old_prev, new_prev, 1)
content_norm = content_norm.replace(old_bulk, new_bulk, 1)

content_out = content_norm.replace("\n", "\r\n")
with open(file_path, "w", encoding="utf-8", newline="") as f:
    f.write(content_out)

print("Successfully updated sama.ts")
