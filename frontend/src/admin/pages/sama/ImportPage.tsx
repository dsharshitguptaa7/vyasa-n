import React, { useEffect, useState } from 'react';
import { Button, Badge, Modal, Select, EmptyState } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { samaAdminService } from '../../services/samaAdminService';
import {
  ImportBatchRecord,
  ImportPreviewResult,
  ImportExecuteResult,
} from '../../types/sama';

export const ImportPage: React.FC = () => {
  const [batches, setBatches] = useState<ImportBatchRecord[]>([]);
  const [totalBatches, setTotalBatches] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [activeTab, setActiveTab] = useState<'upload' | 'bundle'>('bundle');
  const [entityType, setEntityType] = useState<string>('publications');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Preview state
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [bundlePreviewResult, setBundlePreviewResult] = useState<Record<string, any> | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await samaAdminService.getImportBatches({ limit: 10 });
      setBatches(res.items);
      setTotalBatches(res.total);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load import batch history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleGenerateFilePreview = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select a file to import (JSON, CSV, or Excel).');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await samaAdminService.previewImport(entityType, selectedFile);
      setPreviewResult(res);
      setBundlePreviewResult(null);
      setSuccessMsg(`Preview generated for batch ${res.batch_number}. Review the reconciliation report below.`);
      fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate import preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunBundleSimulation = async (dryRun: boolean) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await samaAdminService.importHistoricalBundle({ dry_run: dryRun });
      setBundlePreviewResult(res);
      setPreviewResult(null);
      if (dryRun) {
        setSuccessMsg(`Historical bundle simulated successfully (Batch: ${res.batch_number}). No persistent records were modified.`);
      } else {
        setSuccessMsg(`Historical bundle executed successfully! Records imported into SAMIKSHA.`);
      }
      fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to run historical bundle reconciliation.');
    } finally {
      setLoading(false);
      setIsExecuting(false);
      setIsConfirmModalOpen(false);
    }
  };

  const handleConfirmExecute = async () => {
    if (previewResult) {
      try {
        setIsExecuting(true);
        setErrorMsg(null);
        const res: ImportExecuteResult = await samaAdminService.executeImport(previewResult.batch_id);
        setSuccessMsg(`Batch ${res.batch_number} executed successfully. ${res.created_count} records created in draft state.`);
        setPreviewResult(null);
        fetchBatches();
      } catch (err: any) {
        setErrorMsg(err.message || 'Import execution failed.');
      } finally {
        setIsExecuting(false);
        setIsConfirmModalOpen(false);
      }
    } else if (bundlePreviewResult) {
      handleRunBundleSimulation(false);
    }
  };

  return (
    <AdminLayout activeTab="sama-import">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b2811a' }}>
              SAMIKSHA Administration
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#171717', margin: '4px 0 0 0' }}>
              Historical Data Import & Reconciliation
            </h1>
            <p style={{ fontSize: '13px', color: '#737373', margin: '4px 0 0 0' }}>
              Safely validate, preview, and ingest research records into SAMIKSHA with automated duplicate detection and auditable ledger tracking.
            </p>
          </div>
        </div>

        {/* Messages */}
        {errorMsg && batches.length > 0 && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>✕</button>
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} style={{ border: 'none', background: 'transparent', color: '#22c55e', cursor: 'pointer', fontWeight: 600 }}>✕</button>
          </div>
        )}

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e5e5', paddingBottom: '12px' }}>
          <Button
            variant={activeTab === 'bundle' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('bundle')}
          >
            Historical Portfolio Bundle
          </Button>
          <Button
            variant={activeTab === 'upload' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('upload')}
          >
            Custom File Import (JSON / CSV / Excel)
          </Button>
        </div>

        {/* Tab 1: Historical Bundle */}
        {activeTab === 'bundle' && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: 0 }}>
                Historical Research Felicitation Portfolio
              </h3>
              <p style={{ fontSize: '13px', color: '#737373', marginTop: '4px' }}>
                Reconciles historical research publications (207 items across Vol 2 Issue 1 & 2), Scopus author identities,
                research bulletins, certificate documents, CAM-AI project showcases, active fellowship schemes, and faculty spotlights.
              </p>
            </div>

            <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
              <strong>Ecosystem Policy:</strong> All imported publications and bulletins will start in an unverified <code style={{ background: '#fef3c7', padding: '2px 4px', borderRadius: '4px' }}>draft</code> state.
              Imported authors will remain marked as <code style={{ background: '#fef3c7', padding: '2px 4px', borderRadius: '4px' }}>is_verified=False</code> (provisional) until formal institutional verification.
            </div>

            <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
              <Button
                variant="primary"
                onClick={() => handleRunBundleSimulation(true)}
                disabled={loading}
              >
                {loading ? 'Simulating...' : 'Run Historical Dry-Run Preview'}
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Custom File Upload */}
        {activeTab === 'upload' && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: 0 }}>
              Upload Single Entity Batch
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#404040', marginBottom: '4px' }}>
                  Target Entity
                </label>
                <Select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  options={[
                    { label: 'Publications', value: 'publications' },
                    { label: 'Authors & Identities', value: 'authors' },
                    { label: 'CAM-AI Projects', value: 'cam_projects' },
                    { label: 'Fellowship Schemes', value: 'fellowships' },
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#404040', marginBottom: '4px' }}>
                  Data File (.json, .csv, .xlsx)
                </label>
                <input
                  type="file"
                  accept=".json,.csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: 'block', width: '100%', fontSize: '13px', color: '#737373' }}
                />
              </div>
            </div>

            <div style={{ paddingTop: '8px' }}>
              <Button
                variant="primary"
                onClick={handleGenerateFilePreview}
                disabled={loading || !selectedFile}
              >
                {loading ? 'Validating...' : 'Generate Dry-Run Preview'}
              </Button>
            </div>
          </div>
        )}

        {/* Preview Summary Card: File Import */}
        {previewResult && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', margin: 0 }}>
                  Preview Summary: {previewResult.batch_number}
                </h4>
                <p style={{ fontSize: '12px', color: '#737373', margin: '2px 0 0 0' }}>
                  Target: {previewResult.entity_type.toUpperCase()} • Mode: {previewResult.mode.toUpperCase()} • Total Rows: {previewResult.total_rows}
                </p>
              </div>
              <Button
                variant="teal"
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={previewResult.create_count === 0 && previewResult.update_count === 0}
              >
                Execute Batch Import
              </Button>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#171717' }}>{previewResult.total_rows}</div>
                <div style={{ fontSize: '11px', color: '#737373' }}>Total Rows</div>
              </div>
              <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>{previewResult.create_count}</div>
                <div style={{ fontSize: '11px', color: '#059669' }}>To Create (Draft)</div>
              </div>
              <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{previewResult.update_count}</div>
                <div style={{ fontSize: '11px', color: '#2563eb' }}>To Update</div>
              </div>
              <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706' }}>{previewResult.review_count}</div>
                <div style={{ fontSize: '11px', color: '#d97706' }}>Conflicts / Review</div>
              </div>
              <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#737373' }}>{previewResult.skip_count}</div>
                <div style={{ fontSize: '11px', color: '#737373' }}>Skipped (Exists)</div>
              </div>
            </div>

            {/* Items Table */}
            {previewResult.items && previewResult.items.length > 0 && (
              <div style={{ overflowX: 'auto', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb', color: '#404040' }}>
                    <tr>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Action</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Identifier</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Reconciliation Reason</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.items.map((item, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #e5e5e5' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge
                            variant={
                              item.action === 'create' ? 'teal' :
                              item.action === 'update' ? 'primary' :
                              item.action === 'review' ? 'saffron' : 'neutral'
                            }
                          >
                            {item.action.toUpperCase()}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{item.identifier}</td>
                        <td style={{ padding: '10px 12px', color: '#525252' }}>{item.reason}</td>
                        <td style={{ padding: '10px 12px', color: '#737373', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(item.record_summary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Preview Summary Card: Historical Bundle */}
        {bundlePreviewResult && (
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', margin: 0 }}>
                  Historical Bundle Simulation: {bundlePreviewResult.batch_number}
                </h4>
                <p style={{ fontSize: '12px', color: '#737373', margin: '2px 0 0 0' }}>
                  Source: {bundlePreviewResult.source_dir} • Mode: {bundlePreviewResult.dry_run ? 'DRY RUN (Preview)' : 'EXECUTED'}
                </p>
              </div>
              {bundlePreviewResult.dry_run && (
                <Button
                  variant="teal"
                  onClick={() => setIsConfirmModalOpen(true)}
                >
                  Execute Historical Import
                </Button>
              )}
            </div>

            {/* Breakdown by entity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {Object.entries(bundlePreviewResult.entities || {}).map(([key, val]: [string, any]) => (
                <div key={key} style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#737373' }}>{key}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#171717', marginTop: '4px' }}>
                    {val.created ?? 0} <span style={{ fontSize: '11px', fontWeight: 400, color: '#737373' }}>new</span>
                  </div>
                  {val.skipped !== undefined && (
                    <div style={{ fontSize: '11px', color: '#737373' }}>{val.skipped} skipped</div>
                  )}
                  {val.updated !== undefined && (
                    <div style={{ fontSize: '11px', color: '#2563eb' }}>{val.updated} updated</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch History Section */}
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#171717', margin: 0 }}>
              Import Batch History ({totalBatches})
            </h3>
            <Button variant="outline" onClick={fetchBatches} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              Loading batch history...
            </div>
          ) : errorMsg ? (
            <div
              data-testid="import-error-state"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                padding: '32px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ color: '#991b1b', fontWeight: 600, fontSize: '15px' }}>
                Failed to load import batch history
              </div>
              <div style={{ color: '#64748b', fontSize: '13px' }}>{errorMsg}</div>
              <Button variant="primary" size="sm" onClick={fetchBatches}>
                Retry
              </Button>
            </div>
          ) : batches.length === 0 ? (
            <EmptyState
              title="No Import Batches Recorded"
              description="Uploaded and simulated import batches will be listed here with audit ledgers."
            />
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
              <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', color: '#404040' }}>
                  <tr>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Batch Number</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Entity</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Source File</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Rows</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Created</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Updated</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Skipped</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} style={{ borderTop: '1px solid #e5e5e5' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{b.batch_number}</td>
                      <td style={{ padding: '10px 12px', textTransform: 'uppercase', color: '#525252' }}>{b.entity_type}</td>
                      <td style={{ padding: '10px 12px', color: '#525252' }}>{b.source_filename}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge
                          variant={
                            b.status === 'completed' ? 'teal' :
                            b.status === 'previewed' ? 'saffron' : 'neutral'
                          }
                        >
                          {b.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{b.total_rows}</td>
                      <td style={{ padding: '10px 12px', color: '#059669', fontWeight: 600 }}>{b.created_count}</td>
                      <td style={{ padding: '10px 12px', color: '#2563eb' }}>{b.updated_count}</td>
                      <td style={{ padding: '10px 12px', color: '#737373' }}>{b.skipped_count}</td>
                      <td style={{ padding: '10px 12px', color: '#737373' }}>
                        {new Date(b.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm Import Batch Execution"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', color: '#404040' }}>
            <p style={{ margin: 0 }}>
              Are you sure you want to execute this import batch into the SAMIKSHA repository?
            </p>
            <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>• <strong>Draft Protection:</strong> All publications and bulletins will be initialized in non-public <code style={{ background: '#fef3c7', padding: '1px 3px' }}>draft</code> state.</div>
              <div>• <strong>Provisional Authors:</strong> Authors will remain marked as <code style={{ background: '#fef3c7', padding: '1px 3px' }}>is_verified=False</code>.</div>
              <div>• <strong>Audit Ledger:</strong> This operation will be permanently recorded in the institutional audit log with actor ID and checksum.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
              <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="teal" onClick={handleConfirmExecute} disabled={isExecuting}>
                {isExecuting ? 'Executing...' : 'Confirm & Execute Import'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};
