import React, { useState, useMemo } from 'react';
import { Badge, EmptyState, SectionHeading, Select, Input, Button, AppIcon } from '@vyasa/ui';
import { PublicCamProject } from '../services/samaVedaService';
import { extractPrimaryPIName, formatInvestigatorNames } from '../../../admin/utils/investigators';

interface SamikshaCamProjectsTabProps {
  camProjects: PublicCamProject[];
}

export const SamikshaCamProjectsTab: React.FC<SamikshaCamProjectsTabProps> = ({ camProjects }) => {
  const [domainFilter, setDomainFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const domains = useMemo(() => {
    const set = new Set<string>();
    camProjects.forEach((p) => {
      if (p.domain?.trim()) set.add(p.domain.trim());
    });
    return Array.from(set).sort();
  }, [camProjects]);

  const filteredProjects = useMemo(() => {
    return camProjects.filter((p) => {
      if (domainFilter && p.domain?.toLowerCase() !== domainFilter.toLowerCase()) return false;
      if (categoryFilter && p.category?.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesTitle = p.title?.toLowerCase().includes(q);
        const matchesDomain = p.domain?.toLowerCase().includes(q);
        const piName = extractPrimaryPIName((p as any).principal_investigator, p.principal_investigators);
        const matchesPi = (piName || '').toLowerCase().includes(q);
        const coPiNames = formatInvestigatorNames(p.co_investigators);
        const matchesCoPi = (coPiNames || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDomain && !matchesPi && !matchesCoPi) return false;
      }
      return true;
    });
  }, [camProjects, domainFilter, categoryFilter, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <SectionHeading
        eyebrow="Funded Research Grants"
        title="CAM-AI Research Projects"
        description="Interdisciplinary AI initiatives under the Centre of Applied Mathematics and Artificial Intelligence."
      />

      {/* Filter Bar */}
      <div className="samiksha-filter-bar">
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="Search projects by title, domain, or investigator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search CAM-AI projects"
          />
        </div>

        {domains.length > 0 && (
          <div style={{ width: '180px' }}>
            <Select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              options={[
                { label: 'All Domains', value: '' },
                ...domains.map((d) => ({ label: d, value: d })),
              ]}
              aria-label="Filter by domain"
            />
          </div>
        )}

        <div style={{ width: '160px' }}>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { label: 'All Categories', value: '' },
              { label: 'Major Grants', value: 'Major' },
              { label: 'Minor Grants', value: 'Minor' },
            ]}
            aria-label="Filter by grant category"
          />
        </div>

        {(search || domainFilter || categoryFilter) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setDomainFilter('');
              setCategoryFilter('');
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {filteredProjects.length === 0 ? (
        <EmptyState
          title="No CAM-AI Projects Available"
          description="Project showcases will appear here once registered. Try adjusting your search filters."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '22px' }}>
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              className="samiksha-card samiksha-interactive-lift"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '18px',
                padding: '26px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <Badge variant={p.category === 'Major' ? 'teal' : 'primary'}>{p.category || 'Grant'}</Badge>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#0d766e',
                      background: '#f0fdfa',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      border: '1px solid #99f6e4',
                    }}
                  >
                    {p.funding_display ||
                      (p as any).funding_amount_display ||
                      (p.funding_amount_inr != null
                        ? `₹${Number(p.funding_amount_inr).toLocaleString('en-IN')}`
                        : (p as any).funding_amount != null
                        ? `₹${Number((p as any).funding_amount).toLocaleString('en-IN')}`
                        : 'Funded')}
                  </span>
                </div>
                {p.domain && (
                  <div style={{ fontSize: '12px', color: '#b2811a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {p.domain}
                  </div>
                )}
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f2b48', margin: '8px 0 14px 0', lineHeight: 1.4 }}>
                  {p.title}
                </h3>

                {(() => {
                  const piName = extractPrimaryPIName((p as any).principal_investigator, p.principal_investigators);
                  if (!piName) return null;
                  const piObj = Array.isArray(p.principal_investigators)
                    ? p.principal_investigators.find((i: any) => typeof i === 'object' && i && i.name)
                    : null;
                  const dept = piObj && typeof piObj === 'object' && piObj.department ? ` (${piObj.department})` : '';
                  return (
                    <div style={{ fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                      <strong style={{ color: '#0f2b48' }}>PI:</strong> {piName}{dept}
                    </div>
                  );
                })()}
                {(() => {
                  const coPiDisplay = formatInvestigatorNames(p.co_investigators);
                  if (!coPiDisplay) return null;
                  return (
                    <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                      <strong style={{ color: '#475569' }}>Co-PI:</strong> {coPiDisplay}
                    </div>
                  );
                })()}
              </div>
              <div
                style={{
                  fontSize: '12.5px',
                  color: '#059669',
                  fontWeight: 600,
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AppIcon name="check-circle" size={14} color="#059669" />
                <span>Status: {p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
