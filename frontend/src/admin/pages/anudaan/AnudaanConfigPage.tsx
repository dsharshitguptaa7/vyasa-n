import React, { useState, useEffect } from 'react';
import { Button, Input } from '@vyasa/ui';
import { AdminLayout } from '../../components/AdminLayout';
import { anudaanAdminService } from '../../services/anudaanAdminService';
// import types

export const AnudaanConfigPage: React.FC = () => {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [impactEnabled, setImpactEnabled] = useState(true);
  const [galleryEnabled, setGalleryEnabled] = useState(true);
  const [activeYear, setActiveYear] = useState('');
  const [bannerNote, setBannerNote] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const data = await anudaanAdminService.getConfig();
        setLastUpdated(data.updated_at || null);
        setImpactEnabled(data.impact_section_enabled);
        setGalleryEnabled(data.gallery_section_enabled);
        setActiveYear(data.active_academic_year || '');
        setBannerNote(data.custom_banner_note || '');
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Failed to load configuration.' });
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await anudaanAdminService.updateConfig({
        impact_section_enabled: impactEnabled,
        gallery_section_enabled: galleryEnabled,
        active_academic_year: activeYear.trim() || null,
        custom_banner_note: bannerNote.trim() || null,
      });
      setLastUpdated(updated.updated_at || null);
      setFeedback({ type: 'success', message: 'Public ANUDAAN display configuration updated successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save configuration.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout activeTab="anudaan-config">
      <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0B2545', margin: '0 0 6px' }}>
            ANUDAAN Public Showcase Configuration
          </h1>
          <p style={{ color: '#4A5568', margin: 0, fontSize: '0.95rem' }}>
            Control visibility of the Institutional Incentive Impact Dashboard and Researcher Recognition Gallery on the public portal.
          </p>
          {lastUpdated && <p style={{ color: '#718096', margin: '4px 0 0', fontSize: '0.8rem' }}>Last synchronized: {new Date(lastUpdated).toLocaleString()}</p>}
        </div>

        {feedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 6,
              marginBottom: 20,
              backgroundColor: feedback.type === 'success' ? '#DEF7EC' : '#FDE8E8',
              color: feedback.type === 'success' ? '#03543F' : '#9B1C1C',
              border: `1px solid ${feedback.type === 'success' ? '#84E1BC' : '#F8B4B4'}`,
            }}
          >
            {feedback.message}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>Loading configuration...</div>
        ) : (
          <form
            onSubmit={handleSave}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              padding: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Section Toggles */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0B2545', margin: '0 0 14px' }}>
                Public Section Visibility
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={impactEnabled}
                    onChange={(e) => setImpactEnabled(e.target.checked)}
                    style={{ marginTop: 4 }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, color: '#1E293B', display: 'block', fontSize: '0.95rem' }}>
                      Section B: Institutional Incentive Impact Dashboard
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                      Displays aggregated claims received, approved, researchers benefited, and verified disbursed funds.
                    </span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={galleryEnabled}
                    onChange={(e) => setGalleryEnabled(e.target.checked)}
                    style={{ marginTop: 4 }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, color: '#1E293B', display: 'block', fontSize: '0.95rem' }}>
                      Section C: Researcher Recognition & Ceremony Gallery
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                      Displays curated university felicitation ceremonies, recipient spotlights, and authorized ceremony photography.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '4px 0' }} />

            {/* Reporting Period */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Default Public Reporting Period (Optional)
              </label>
              <Input
                value={activeYear}
                onChange={(e) => setActiveYear(e.target.value)}
                placeholder="e.g. 2025-2026 (Leave blank for consolidated latest)"
              />
              <span style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4, display: 'block' }}>
                Sets the initial preselected academic year on the public statistics dashboard.
              </span>
            </div>

            {/* Custom Advisory Banner Note */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Institutional Advisory / Audit Note (Optional)
              </label>
              <textarea
                value={bannerNote}
                onChange={(e) => setBannerNote(e.target.value)}
                placeholder="e.g. Incentive disbursement figures represent bank-verified transfers reconciled by the CSJMU Accounts division as of latest audit cycle."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4, display: 'block' }}>
                Rendered as an official institutional notice directly above the public impact statistics.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <a
                href="/modules/yajur-veda/anudaan"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.875rem', color: '#2563EB', textDecoration: 'none', fontWeight: 500 }}
              >
                ↗ Preview Public ANUDAAN Portal
              </a>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};
