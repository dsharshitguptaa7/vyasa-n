import re

file_path = "frontend/src/admin/pages/sama/CertificatesPage.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add state variables
old_state = '''  const [wizardSubmitMode, setWizardSubmitMode] = useState<'APPROVAL' | 'DIRECT' | 'DRAFT'>('APPROVAL');
  const [wizardDirectJustification, setWizardDirectJustification] = useState('');'''

new_state = '''  const [wizardSubmitMode, setWizardSubmitMode] = useState<'APPROVAL' | 'DIRECT' | 'DRAFT'>('APPROVAL');
  const [wizardDirectJustification, setWizardDirectJustification] = useState('');

  // Manual Certificate Number & Verification Identifier Overrides
  const [wizardCertNumber, setWizardCertNumber] = useState('');
  const [wizardVerificationId, setWizardVerificationId] = useState('');
  const [wizardVerificationUrlPreview, setWizardVerificationUrlPreview] = useState('');
  const [wizardUrlExtractionNotice, setWizardUrlExtractionNotice] = useState<string | null>(null);

  const handleVerificationIdChange = (inputVal: string) => {
    let cleanVal = inputVal.trim();
    setWizardUrlExtractionNotice(null);

    // If a full verification URL is pasted, extract the identifier
    if (cleanVal.includes('://') || cleanVal.startsWith('/')) {
      const urlPattern = /^(?:https?:\\/\\/[^\\/]+)?(?:\\/api)?(?:\\/modules\\/sama-veda)?\\/(?:certificates\\/)?verify\\/([a-zA-Z0-9_\\-]+)\\/?$/i;
      const match = cleanVal.match(urlPattern);
      if (match && match[1]) {
        cleanVal = match[1];
        setWizardUrlExtractionNotice(`Extracted verification identifier: "${cleanVal}" from pasted URL.`);
      } else {
        setWizardUrlExtractionNotice('Warning: Pasted URL does not match the expected application verification route (/verify/{identifier}).');
      }
    }

    setWizardVerificationId(cleanVal);

    if (cleanVal) {
      const baseUrl = window.location.origin;
      setWizardVerificationUrlPreview(`${baseUrl}/verify/${cleanVal}`);
    } else {
      setWizardVerificationUrlPreview('');
    }
  };'''

# 2. Reset states in handleOpenWizard
old_reset = '''    setWizardSubmitMode('APPROVAL');
    setWizardDirectJustification('');'''

new_reset = '''    setWizardSubmitMode('APPROVAL');
    setWizardDirectJustification('');
    setWizardCertNumber('');
    setWizardVerificationId('');
    setWizardVerificationUrlPreview('');
    setWizardUrlExtractionNotice(null);'''

# 3. Update preview call in handleGenerateWizardPreview
old_prev_call = '''        bulletin_id: wizardBulletinId || null,
        publication_details: incDetails,
        issue_date: wizardIssueDate || undefined,
        authors: wizardAuthors,
      });'''

new_prev_call = '''        bulletin_id: wizardBulletinId || null,
        publication_details: incDetails,
        issue_date: wizardIssueDate || undefined,
        authors: wizardAuthors,
        certificate_number: wizardCertNumber.trim() || undefined,
        verification_token: wizardVerificationId.trim() || undefined,
        verification_identifier: wizardVerificationId.trim() || undefined,
      });'''

# 4. Update submit call in handleSubmitWizard
old_submit_call = '''        authors: wizardAuthors,
        submit_for_approval: submitForApproval,
        direct_issue_justification: wizardSubmitMode === 'DIRECT' ? wizardDirectJustification.trim() : undefined,
      });'''

new_submit_call = '''        authors: wizardAuthors,
        submit_for_approval: submitForApproval,
        direct_issue_justification: wizardSubmitMode === 'DIRECT' ? wizardDirectJustification.trim() : undefined,
        certificate_number: wizardCertNumber.trim() || undefined,
        verification_identifier: wizardVerificationId.trim() || undefined,
        verification_token: wizardVerificationId.trim() || undefined,
      });'''

# 5. Add UI card in Step 4 right above Submission Workflow Mode Selection
old_step4_ui = '''                  {/* Submission Workflow Mode Selection */}
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Issuance Workflow Mode</label>'''

new_step4_ui = '''                  {/* Manual Identifiers & Legacy QR Restoration Overrides (Optional) */}
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F2B48' }}>
                        Manual Identifiers & Legacy QR Restoration (Optional)
                      </span>
                      <Badge variant="neutral">Optional Overrides</Badge>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginBottom: '12px', lineHeight: '1.4' }}>
                      Leave blank to use automatic generation. Enter manual values only when specific credentials or previously printed QR verification URLs must be restored.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {/* Certificate Number */}
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                          Certificate Number (Optional)
                        </label>
                        <Input
                          value={wizardCertNumber}
                          onChange={(e) => setWizardCertNumber(e.target.value)}
                          placeholder="Auto-generated if left blank"
                          style={{ fontSize: '12.5px' }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', lineHeight: '1.3' }}>
                          Leave blank to generate automatically. Enter a value only when a specific certificate number is required.
                        </div>
                      </div>

                      {/* Verification Identifier */}
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                          Verification Identifier (Optional)
                        </label>
                        <Input
                          value={wizardVerificationId}
                          onChange={(e) => handleVerificationIdChange(e.target.value)}
                          placeholder="Auto-generated if left blank"
                          style={{ fontSize: '12.5px' }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', lineHeight: '1.3' }}>
                          Leave blank to generate automatically. Enter an existing identifier to restore a previously printed QR verification URL.
                        </div>
                      </div>
                    </div>

                    {/* Extracted URL Notice */}
                    {wizardUrlExtractionNotice && (
                      <div style={{ marginTop: '10px', fontSize: '11.5px', color: wizardUrlExtractionNotice.startsWith('Warning') ? '#DC2626' : '#059669', fontWeight: 500 }}>
                        {wizardUrlExtractionNotice}
                      </div>
                    )}

                    {/* Live Verification URL Preview */}
                    {wizardVerificationUrlPreview && (
                      <div style={{ marginTop: '10px', padding: '8px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Resolved Verification URL:</span>
                        <code style={{ fontSize: '11.5px', color: '#15803D', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                          {wizardVerificationUrlPreview}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Submission Workflow Mode Selection */}
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Issuance Workflow Mode</label>'''

content_norm = content.replace("\r\n", "\n")
assert old_state in content_norm, "old_state not found"
assert old_reset in content_norm, "old_reset not found"
assert old_prev_call in content_norm, "old_prev_call not found"
assert old_submit_call in content_norm, "old_submit_call not found"
assert old_step4_ui in content_norm, "old_step4_ui not found"

content_norm = content_norm.replace(old_state, new_state, 1)
content_norm = content_norm.replace(old_reset, new_reset, 1)
content_norm = content_norm.replace(old_prev_call, new_prev_call, 1)
content_norm = content_norm.replace(old_submit_call, new_submit_call, 1)
content_norm = content_norm.replace(old_step4_ui, new_step4_ui, 1)

content_out = content_norm.replace("\n", "\r\n")
with open(file_path, "w", encoding="utf-8", newline="") as f:
    f.write(content_out)

print("Successfully updated CertificatesPage.tsx")
