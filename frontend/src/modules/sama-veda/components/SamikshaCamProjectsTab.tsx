import React, { useState, useMemo } from 'react';
import { Badge, EmptyState, SectionHeading, Select, Input, Button } from '@vyasa/ui';
import { PublicCamProject } from '../services/samaVedaService';

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
        const matchesPi = p.principal_investigators?.some((pi) => pi.name?.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDomain && !matchesPi) return false;
      }
      return true;
    });
  }, [camProjects, domainFilter, categoryFilter, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeading
        eyebrow="Funded Research Grants"
        title="CAM-AI Research Projects"
        description="Interdisciplinary AI initiatives under the Centre of Applied Mathematics and Artificial Intelligence."
      />

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          background: '#ffffff',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              style={{
                background: '#ffffff',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: '0 2px 8px rgba(15, 43, 72, 0.04)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <Badge variant={p.category === 'Major' ? 'teal' : 'primary'}>{p.category || 'Grant'}</Badge>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d766e' }}>{p.funding_display || 'Funded'}</span>
                </div>
                {p.domain && (
                  <div style={{ fontSize: '12px', color: '#b2811a', fontWeight: 600 }}>{p.domain}</div>
                )}
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2b48', margin: '8px 0 12px 0', lineHeight: 1.4 }}>
                  {p.title}
                </h3>

                {p.principal_investigators && p.principal_investigators.length > 0 && (
                  <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '4px' }}>
                    <strong>PI:</strong> {p.principal_investigators.map((i: any) => `${i.name} (${i.department || ''})`).join(', ')}
                  </div>
                )}
                {p.co_investigators && p.co_investigators.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    <strong>Co-PI:</strong> {p.co_investigators.map((i: any) => `${i.name}`).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                Status: {p.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
