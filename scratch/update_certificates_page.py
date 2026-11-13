import re

path = 'frontend/src/admin/pages/sama/CertificatesPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. State insertion
state_anchor = "  const [signatureUploadFile, setSignatureUploadFile] = useState<File | null>(null);"
new_state = """  const [signatureUploadFile, setSignatureUploadFile] = useState<File | null>(null);

  // Enhanced Signatory Management State
  const [editingSignatoryId, setEditingSignatoryId] = useState<string | null>(null);
  const [showUploadSignatureModal, setShowUploadSignatureModal] = useState(false);
  const [selectedSignatoryForUpload, setSelectedSignatoryForUpload] = useState<CertificateSignatoryItem | null>(null);
  const [signaturePreviewSignatory, setSignaturePreviewSignatory] = useState<CertificateSignatoryItem | null>(null);
  const [deleteSignatoryTarget, setDeleteSignatoryTarget] = useState<CertificateSignatoryItem | null>(null);
  const [signatureFilePreviewUrl, setSignatureFilePreviewUrl] = useState<string | null>(null);"""

assert state_anchor in text, "State anchor not found"
text = text.replace(state_anchor, new_state, 1)

# 2. Handler replacement
handler_pattern = re.compile(r"  const handleCreateSignatory = async \(\) => \{.+?^\s*loadReferenceData\(\);\s*\}\s*catch.+?^\s*\}\s*finally\s*\{.+?^\s*\}\s*\};", re.MULTILINE | re.DOTALL)

new_handlers = """  const handleOpenAddSignatory = () => {
    setEditingSignatoryId(null);
    setSignatoryForm({
      authority_type: 'DEAN_RD',
      signatory_name: '',
      designation: '',
      department: 'CSJMU, Kanpur',
      is_active: true,
    });
    setSignatureUploadFile(null);
    setSignatureFilePreviewUrl(null);
    setShowSignatoryModal(true);
  };

  const handleOpenEditSignatory = (sig: CertificateSignatoryItem) => {
    setEditingSignatoryId(sig.id);
    setSignatoryForm({
      authority_type: sig.authority_type,
      signatory_name: sig.signatory_name,
      designation: sig.designation,
      department: sig.department || '',
      is_active: sig.is_active,
    });
    setSignatureUploadFile(null);
    setSignatureFilePreviewUrl(null);
    setShowSignatoryModal(true);
  };

  const handleSaveSignatory = async () => {
    if (!signatoryForm.signatory_name.trim() || !signatoryForm.designation.trim()) {
      setError('Signatory full name and official designation are required.');
      return;
    }
    try {
      setSubmitting(true);
      if (editingSignatoryId) {
        await samaAdminService.updateSignatory(editingSignatoryId, {
          authority_type: signatoryForm.authority_type,
          signatory_name: signatoryForm.signatory_name.trim(),
          designation: signatoryForm.designation.trim(),
          department: signatoryForm.department?.trim() || undefined,
          is_active: signatoryForm.is_active,
        });
        setSuccessMessage(`Authority details updated for ${signatoryForm.signatory_name}.`);
      } else {
        const sig = await samaAdminService.createSignatory({
          ...signatoryForm,
          signatory_name: signatoryForm.signatory_name.trim(),
          designation: signatoryForm.designation.trim(),
        });
        if (signatureUploadFile) {
          await samaAdminService.uploadSignatorySignature(sig.id, signatureUploadFile);
        }
        setSuccessMessage(`Signing authority ${signatoryForm.signatory_name} created successfully.`);
      }
      setShowSignatoryModal(false);
      setEditingSignatoryId(null);
      setSignatureUploadFile(null);
      setSignatureFilePreviewUrl(null);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to save signatory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSignatoryActive = async (sig: CertificateSignatoryItem) => {
    try {
      setSubmitting(true);
      await samaAdminService.toggleSignatoryActive(sig.id);
      setSuccessMessage(`Authority ${sig.signatory_name} status updated.`);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to toggle status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenUploadSignatureModal = (sig: CertificateSignatoryItem) => {
    setSelectedSignatoryForUpload(sig);
    setSignatureUploadFile(null);
    setSignatureFilePreviewUrl(null);
    setShowUploadSignatureModal(true);
  };

  const handleSignatureFileSelect = (file: File | null) => {
    setSignatureUploadFile(file);
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setSignatureFilePreviewUrl(objectUrl);
    } else {
      setSignatureFilePreviewUrl(null);
    }
  };

  const handleUploadSignatureSubmit = async () => {
    if (!selectedSignatoryForUpload || !signatureUploadFile) {
      setError('Please select an authorized transparent PNG or JPEG signature file.');
      return;
    }
    try {
      setSubmitting(true);
      await samaAdminService.uploadSignatorySignature(selectedSignatoryForUpload.id, signatureUploadFile);
      setSuccessMessage(`Digital signature asset uploaded for ${selectedSignatoryForUpload.signatory_name}.`);
      setShowUploadSignatureModal(false);
      setSelectedSignatoryForUpload(null);
      setSignatureUploadFile(null);
      setSignatureFilePreviewUrl(null);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to upload signature');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSignatoryConfirm = async () => {
    if (!deleteSignatoryTarget) return;
    try {
      setSubmitting(true);
      const res = await samaAdminService.deleteSignatory(deleteSignatoryTarget.id);
      setSuccessMessage(res.message || 'Signing authority deleted.');
      setDeleteSignatoryTarget(null);
      loadReferenceData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setError(e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to delete authority');
    } finally {
      setSubmitting(false);
    }
  };"""

assert handler_pattern.search(text), "Handler pattern not matched"
text = handler_pattern.sub(new_handlers, text, count=1)

# 3. Tab content replacement
tab_pattern = re.compile(r"\{\/\* =+ \*\/\}\s*\{activeTab === 'signatories' && \(.*?\{\/\* =+ \*\/\}\s*\{\/\* MODAL: CREATE JOINT CERTIFICATE WIZARD", re.DOTALL)

new_tab_content = """{/* =================================================================== */}
        {activeTab === 'signatories' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F2B48' }}>
                  Signing Authorities & Digital Signature Management
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  Manage authorized institutional signatories (Dean – R&D and Vice Chancellor), upload genuine transparent signature assets, and maintain immutable cryptographic snapshots for certificate issuance.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={handleOpenAddSignatory}>
                <span style={{ marginRight: '6px' }}>+</span>
                Add Signing Authority
              </Button>
            </div>

            {/* Information Notice */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderLeft: '4px solid #B2811A',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '20px' }}>🛡️</div>
              <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                <strong>Strict Signature Integrity:</strong> Certificates require genuine transparent PNG signature assets. Simulated or artificial cursive signatures are prohibited. Whenever an authority signs or a certificate is approved, immutable signature snapshots are permanently preserved with the certificate record.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {signatories.map((sig) => {
                const hasSignature = Boolean(sig.signature_image_path);
                const sigUrl = samaAdminService.getSignatorySignatureUrl(sig.id);

                return (
                  <div
                    key={sig.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Badge variant={sig.authority_type === 'DEAN_RD' ? 'primary' : 'gold'}>
                        {sig.authority_type === 'DEAN_RD' ? 'Dean – Research & Development' : 'Vice Chancellor'}
                      </Badge>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Badge variant={sig.is_active ? 'teal' : 'neutral'}>
                          {sig.is_active ? 'Active Signatory' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>

                    {/* Dignitary Info */}
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F2B48' }}>
                        {sig.signatory_name}
                      </div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
                        {sig.designation}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                        {sig.department || 'Chhatrapati Shahu Ji Maharaj University, Kanpur'}
                      </div>
                    </div>

                    {/* Digital Signature Container */}
                    <div
                      style={{
                        background: '#FAF7F0',
                        border: '1px solid #E2D9C8',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#8C6510', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Registered Signature Asset
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          Version: <strong>v{sig.signature_asset_version || 1}</strong>
                        </span>
                      </div>

                      {hasSignature ? (
                        <div
                          style={{
                            background: '#FFFFFF',
                            border: '1px dashed #CBD5E1',
                            borderRadius: '6px',
                            height: '64px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSignaturePreviewSignatory(sig)}
                          title="Click to view high-resolution preview"
                        >
                          <img
                            src={sigUrl}
                            alt={`Signature of ${sig.signatory_name}`}
                            style={{ maxHeight: '52px', maxWidth: '85%', objectFit: 'contain' }}
                            onError={(e) => {
                              // If image fails to load via browser direct fetch, show placeholder
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            background: '#FEF3C7',
                            border: '1px solid #FCD34D',
                            borderRadius: '6px',
                            padding: '10px 12px',
                            fontSize: '12px',
                            color: '#92400E',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span>⚠️</span>
                          <span>
                            No signature uploaded. Official certificates will leave this signature field empty until a transparent PNG is uploaded.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        borderTop: '1px solid #F1F5F9',
                        paddingTop: '12px',
                        marginTop: 'auto',
                      }}
                    >
                      {hasSignature && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSignaturePreviewSignatory(sig)}
                          title="Preview full digital signature"
                        >
                          👁️ Preview
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenUploadSignatureModal(sig)}
                      >
                        ✍️ {hasSignature ? 'Replace Signature' : 'Upload Signature'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditSignatory(sig)}
                      >
                        ✏️ Edit Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleSignatoryActive(sig)}
                        disabled={submitting}
                      >
                        {sig.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteSignatoryTarget(sig)}
                        style={{ color: '#DC2626', borderColor: '#FECACA' }}
                        disabled={submitting}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: CREATE JOINT CERTIFICATE WIZARD"""

assert tab_pattern.search(text), "Tab pattern not matched"
text = tab_pattern.sub(new_tab_content, text, count=1)

# 4. Modals replacement at end of file
modal_pattern = re.compile(r"\{\/\* =+ \*\/\}\s*\{\/\* MODAL: ADD SIGNATORY \*\/\}[\s\S]*?<\/AdminLayout>", re.MULTILINE)

new_modals = """{/* =================================================================== */}
        {/* MODAL: ADD / EDIT SIGNATORY */}
        {/* =================================================================== */}
        {showSignatoryModal && (
          <Modal
            isOpen={showSignatoryModal}
            onClose={() => {
              setShowSignatoryModal(false);
              setEditingSignatoryId(null);
            }}
            title={editingSignatoryId ? "Edit Signing Authority" : "Add Signing Authority"}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Institutional Authority Role *</label>
                <Select
                  value={signatoryForm.authority_type}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, authority_type: e.target.value })}
                  options={[
                    { label: 'Dean – Research & Development (Dean R&D)', value: 'DEAN_RD' },
                    { label: 'Vice Chancellor (VC)', value: 'VICE_CHANCELLOR' },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Signatory Full Legal Name & Honorific *</label>
                <Input
                  value={signatoryForm.signatory_name}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, signatory_name: e.target.value })}
                  placeholder="e.g. Prof. (Dr.) Rajesh Kumar"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Official Designation *</label>
                <Input
                  value={signatoryForm.designation}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, designation: e.target.value })}
                  placeholder="e.g. Dean – Research & Development"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Department / Office</label>
                <Input
                  value={signatoryForm.department || ''}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, department: e.target.value })}
                  placeholder="e.g. Research & Development Cell, CSJMU Kanpur"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Status</label>
                <Select
                  value={signatoryForm.is_active ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setSignatoryForm({ ...signatoryForm, is_active: e.target.value === 'ACTIVE' })}
                  options={[
                    { label: 'Active (Available for certificate approval & signing)', value: 'ACTIVE' },
                    { label: 'Inactive (Historical / Archived)', value: 'INACTIVE' },
                  ]}
                />
              </div>

              {!editingSignatoryId && (
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                    Signature Asset (Transparent PNG preferred, max 2MB)
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => handleSignatureFileSelect(e.target.files?.[0] || null)}
                    style={{ display: 'block', marginTop: '6px', fontSize: '13px' }}
                  />
                  {signatureFilePreviewUrl && (
                    <div style={{ marginTop: '10px', background: '#FAF7F0', border: '1px dashed #B2811A', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                      <img src={signatureFilePreviewUrl} alt="Preview" style={{ maxHeight: '50px', maxWidth: '80%', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button variant="outline" size="sm" onClick={() => {
                  setShowSignatoryModal(false);
                  setEditingSignatoryId(null);
                }}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveSignatory} disabled={submitting}>
                  {submitting ? 'Saving...' : editingSignatoryId ? 'Update Authority' : 'Create Authority'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: UPLOAD / REPLACE DIGITAL SIGNATURE */}
        {/* =================================================================== */}
        {showUploadSignatureModal && selectedSignatoryForUpload && (
          <Modal
            isOpen={showUploadSignatureModal}
            onClose={() => {
              setShowUploadSignatureModal(false);
              setSelectedSignatoryForUpload(null);
              setSignatureUploadFile(null);
              setSignatureFilePreviewUrl(null);
            }}
            title={`Upload Signature: ${selectedSignatoryForUpload.signatory_name}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F2B48' }}>
                  {selectedSignatoryForUpload.signatory_name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {selectedSignatoryForUpload.designation} ({selectedSignatoryForUpload.authority_type === 'DEAN_RD' ? 'Dean – R&D' : 'Vice Chancellor'})
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                  Current Signature Version: v{selectedSignatoryForUpload.signature_asset_version || 1}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                  Select Signature Asset * (Transparent PNG preferred, max 2MB)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => handleSignatureFileSelect(e.target.files?.[0] || null)}
                  style={{ display: 'block', marginTop: '6px', fontSize: '13px', width: '100%' }}
                />
                <p style={{ margin: '6px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>
                  Notice: Only genuine, transparent PNG or high-resolution JPEG signatures are accepted. AI-generated, typed or simulated signatures are strictly rejected.
                </p>
              </div>

              {signatureFilePreviewUrl && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Live Asset Preview:</div>
                  <div
                    style={{
                      background: '#FAF7F0',
                      border: '1px dashed #B2811A',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center',
                      minHeight: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={signatureFilePreviewUrl}
                      alt="Signature asset preview"
                      style={{ maxHeight: '70px', maxWidth: '90%', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowUploadSignatureModal(false);
                    setSelectedSignatoryForUpload(null);
                    setSignatureUploadFile(null);
                    setSignatureFilePreviewUrl(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUploadSignatureSubmit}
                  disabled={submitting || !signatureUploadFile}
                >
                  {submitting ? 'Uploading...' : 'Confirm & Upload Signature'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: FULL SIGNATURE PREVIEW */}
        {/* =================================================================== */}
        {signaturePreviewSignatory && (
          <Modal
            isOpen={Boolean(signaturePreviewSignatory)}
            onClose={() => setSignaturePreviewSignatory(null)}
            title="Official Digital Signature Preview"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2B48' }}>
                  {signaturePreviewSignatory.signatory_name}
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569' }}>
                  {signaturePreviewSignatory.designation}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Authority Role: {signaturePreviewSignatory.authority_type === 'DEAN_RD' ? 'Dean – Research & Development' : 'Vice Chancellor'} • Asset Version: v{signaturePreviewSignatory.signature_asset_version || 1}
                </div>
              </div>

              <div
                style={{
                  background: '#FAF7F0',
                  border: '2px solid #B2811A',
                  borderRadius: '10px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '140px',
                  gap: '12px',
                }}
              >
                <img
                  src={samaAdminService.getSignatorySignatureUrl(signaturePreviewSignatory.id)}
                  alt={`Signature of ${signaturePreviewSignatory.signatory_name}`}
                  style={{ maxHeight: '110px', maxWidth: '90%', objectFit: 'contain' }}
                />
                <div style={{ width: '160px', height: '1px', background: '#B2811A' }} />
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#061325' }}>
                  {signaturePreviewSignatory.signatory_name}
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  {signaturePreviewSignatory.designation}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <Button variant="primary" size="sm" onClick={() => setSignaturePreviewSignatory(null)}>
                  Close Preview
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================================================================== */}
        {/* MODAL: SAFE DELETE SIGNING AUTHORITY */}
        {/* =================================================================== */}
        {deleteSignatoryTarget && (
          <Modal
            isOpen={Boolean(deleteSignatoryTarget)}
            onClose={() => setDeleteSignatoryTarget(null)}
            title="Delete Signing Authority"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#991B1B' }}>
                <strong>Institutional Dependency Check:</strong> You are about to remove <strong>{deleteSignatoryTarget.signatory_name}</strong> ({deleteSignatoryTarget.designation}).
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                If this authority has approved or signed any existing research certificates, they will be <strong>safely deactivated and soft-deleted</strong>. Previously issued certificates will permanently retain their original signatures, names, designations, and verification records. If unreferenced, the authority will be deleted completely.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                <Button variant="outline" size="sm" onClick={() => setDeleteSignatoryTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeleteSignatoryConfirm}
                  disabled={submitting}
                  style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  {submitting ? 'Processing...' : 'Confirm Safe Deletion'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminLayout>"""

assert modal_pattern.search(text), "Modal pattern not matched"
text = modal_pattern.sub(new_modals, text, count=1)

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("CertificatesPage.tsx successfully updated!")
