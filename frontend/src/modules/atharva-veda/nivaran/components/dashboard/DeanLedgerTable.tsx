import React from 'react';
import { Badge, Button, EmptyState } from '@vyasa/ui';
import { ExecutiveLedgerResponse, ExecutiveLedgerRow } from '../../types/deanDashboard';

interface DeanLedgerTableProps {
  ledgerData: ExecutiveLedgerResponse | null;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSortChange: (column: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  onRowClick: (caseId: string) => void;
  onResetFilters: () => void;
  formatLabel: (str?: string) => string;
  getPriorityBadgeVariant: (priority: string) => 'saffron' | 'teal' | 'primary' | 'neutral';
  getStatusBadgeVariant: (status: string) => 'saffron' | 'teal' | 'primary' | 'neutral';
}

export const DeanLedgerTable: React.FC<DeanLedgerTableProps> = ({
  ledgerData,
  loading,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  sortBy,
  sortDir,
  onSortChange,
  currentPage,
  onPageChange,
  onRowClick,
  onResetFilters,
  formatLabel,
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
}) => {
  // Export CSV handler
  const handleExportCSV = () => {
    if (!ledgerData?.items || ledgerData.items.length === 0) return;

    const headers = [
      'Tracking ID',
      'Title',
      'Subject',
      'Category',
      'Current Stage',
      'Handling Authority',
      'Role',
      'Priority',
      'Status',
      'Total Age',
      'Stage Age',
      'Last Action',
    ];

    const rows = ledgerData.items.map((r) => [
      `"${r.tracking_id}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${r.subject_name || ''}"`,
      `"${r.category_name || ''}"`,
      `"${r.current_level || ''}"`,
      `"${r.current_authority_name || ''}"`,
      `"${r.current_authority_role || ''}"`,
      `"${r.priority || ''}"`,
      `"${r.status || ''}"`,
      `"${r.total_age_display || ''}"`,
      `"${r.current_stage_age_display || ''}"`,
      `"${(r.last_action || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dean_grievance_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIndicator = (column: string) => {
    if (sortBy !== column) {
      return (
        <span style={{ color: '#cbd5e1', marginLeft: '4px', fontSize: '10px' }}>
          ↕
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--vyasa-navy)', marginLeft: '4px', fontSize: '11px', fontWeight: 800 }}>
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  return (
    <div className="nivaran-docket-table-card" style={{ padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
            Executive Grievance Ledger
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
            Comprehensive searchable case database responding dynamically to active executive cross-filters.
          </p>
        </div>

        {/* Search & Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <form onSubmit={onSearchSubmit} className="nivaran-docket-search-wrap">
            <span className="nivaran-docket-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search ID, title, keyword..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="nivaran-docket-search-input"
            />
            <Button type="submit" variant="primary" size="sm" style={{ marginLeft: '6px' }}>
              Search
            </Button>
          </form>

          {ledgerData?.items && ledgerData.items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Export displayed records to CSV"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
          Updating grievance ledger...
        </div>
      ) : !ledgerData?.items || ledgerData.items.length === 0 ? (
        <EmptyState
          title="No matching grievances found"
          description="No institutional grievances match the selected filter criteria or search query."
          action={
            <Button variant="outline" size="sm" onClick={onResetFilters}>
              Reset All Filters
            </Button>
          }
        />
      ) : (
        <div>
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table className="nivaran-docket-table">
              <thead>
                <tr>
                  <th
                    style={{ width: '150px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => onSortChange('tracking_id')}
                    title="Sort by Tracking ID"
                  >
                    Tracking ID {renderSortIndicator('tracking_id')}
                  </th>
                  <th>Subject &amp; Category</th>
                  <th style={{ width: '130px' }}>Current Stage</th>
                  <th>Handling Authority</th>
                  <th
                    style={{ textAlign: 'center', width: '90px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => onSortChange('priority')}
                    title="Sort by Priority"
                  >
                    Priority {renderSortIndicator('priority')}
                  </th>
                  <th
                    style={{ textAlign: 'center', width: '110px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => onSortChange('status')}
                    title="Sort by Status"
                  >
                    Status {renderSortIndicator('status')}
                  </th>
                  <th
                    style={{ width: '90px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => onSortChange('total_age_hours')}
                    title="Sort by Total Age"
                  >
                    Total Age {renderSortIndicator('total_age_hours')}
                  </th>
                  <th
                    style={{ width: '90px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => onSortChange('stage_age_hours')}
                    title="Sort by Current Stage Age"
                  >
                    Stage Age {renderSortIndicator('stage_age_hours')}
                  </th>
                  <th style={{ width: '160px' }}>Last Action</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.items.map((row: ExecutiveLedgerRow) => (
                  <tr
                    key={row.id}
                    className="nivaran-docket-row"
                    onClick={() => onRowClick(row.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="nivaran-docket-cell">
                      <span className="nivaran-tracking-pill">{row.tracking_id}</span>
                    </td>
                    <td className="nivaran-docket-cell">
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-navy)', lineHeight: 1.35 }}>
                        {row.title}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          marginTop: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>{formatLabel(row.subject_name)}</span>
                        <span>&bull;</span>
                        <span className="nivaran-category-chip" title={formatLabel(row.category_name)}>
                          {formatLabel(row.category_name)}
                        </span>
                      </div>
                    </td>
                    <td className="nivaran-docket-cell">
                      <Badge variant="primary" size="sm">
                        {formatLabel(row.current_level)}
                      </Badge>
                    </td>
                    <td className="nivaran-docket-cell">
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                        {row.current_authority_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {formatLabel(row.current_authority_role)}
                      </div>
                    </td>
                    <td className="nivaran-docket-cell" style={{ textAlign: 'center' }}>
                      <Badge variant={getPriorityBadgeVariant(row.priority)} size="sm">
                        {row.priority}
                      </Badge>
                    </td>
                    <td className="nivaran-docket-cell" style={{ textAlign: 'center' }}>
                      <Badge variant={getStatusBadgeVariant(row.status)} size="sm">
                        {formatLabel(row.status)}
                      </Badge>
                    </td>
                    <td className="nivaran-docket-cell" style={{ fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                      {row.total_age_display}
                    </td>
                    <td className="nivaran-docket-cell" style={{ color: '#64748b' }}>
                      {row.current_stage_age_display}
                    </td>
                    <td className="nivaran-docket-cell" style={{ color: '#475569', fontSize: '11px' }}>
                      <div>{row.last_action}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{row.last_action_display}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="nivaran-docket-pagination">
            <div>
              Showing <strong>{(currentPage - 1) * 15 + 1}</strong> to{' '}
              <strong>{Math.min(currentPage * 15, ledgerData.total)}</strong> of{' '}
              <strong>{ledgerData.total}</strong> cases
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                &larr; Previous
              </Button>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  fontWeight: 600,
                  fontSize: '12px',
                }}
              >
                Page {currentPage} of {ledgerData.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= ledgerData.total_pages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                Next &rarr;
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
