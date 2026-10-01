import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DeanExecutiveDashboardPage } from '../pages/DeanExecutiveDashboardPage';
import { grievanceService } from '../services/grievanceService';
import { DeanDashboardDataResponse, ExecutiveLedgerResponse } from '../types/deanDashboard';

// Mock grievanceService
vi.mock('../services/grievanceService', () => ({
  grievanceService: {
    getDeanExecutiveDashboard: vi.fn(),
    getDeanDashboardCases: vi.fn(),
  },
}));

// Mock useAuth
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mock-dean-id',
      email: 'research@csjmu.ac.in',
      fullName: 'Prof. Namita Tiwari',
      roles: ['authority'],
    },
    isAuthority: true,
    isDean: true,
    isApplicant: false,
    isAdmin: false,
    isManager: false,
    isAssistantDean: false,
    isAssociateDean: false,
    authorityRole: 'DEAN',
    authorityDesignation: 'Dean of Research & Development',
  }),
}));

const mockDashboardData: DeanDashboardDataResponse = {
  generated_at: '2026-09-30T10:00:00Z',
  kpis: {
    total_cases: 48,
    active_cases: 36,
    pending_cases: 24,
    in_progress_cases: 8,
    resolved_cases: 10,
    closed_cases: 2,
    escalated_cases: 4,
    awaiting_info_cases: 3,
    critical_urgent_cases: 7,
    reopened_cases: 1,
    resolution_rate: 25.0,
    avg_resolution_time_hours: 48.5,
    avg_resolution_time_display: '2d 0h',
    ai_prediction_accuracy: 94.2,
  },
  workflow_pipeline: [
    { stage_key: 'APPLICANT', stage_name: 'Applicant Intake', order: 1, current_count: 2, percentage_of_active: 5.6, avg_dwell_hours: 1.5, avg_dwell_display: '1h 30m' },
    { stage_key: 'MANAGER', stage_name: 'Central Manager Triage', order: 2, current_count: 6, percentage_of_active: 16.7, avg_dwell_hours: 4.2, avg_dwell_display: '4h 12m' },
    { stage_key: 'ASSISTANT_DEAN', stage_name: 'Assistant Dean Redressal', order: 3, current_count: 14, percentage_of_active: 38.9, avg_dwell_hours: 18.0, avg_dwell_display: '18h' },
    { stage_key: 'ASSOCIATE_DEAN', stage_name: 'Associate Dean Review', order: 4, current_count: 8, percentage_of_active: 22.2, avg_dwell_hours: 26.5, avg_dwell_display: '1d 2h' },
    { stage_key: 'FIXED_AUTHORITY', stage_name: 'Fixed Authority Redressal', order: 5, current_count: 3, percentage_of_active: 8.3, avg_dwell_hours: 12.0, avg_dwell_display: '12h' },
    { stage_key: 'DEAN', stage_name: 'Dean Executive Decision', order: 6, current_count: 3, percentage_of_active: 8.3, avg_dwell_hours: 8.5, avg_dwell_display: '8h 30m' },
    { stage_key: 'RESOLVED', stage_name: 'Resolved & Closed', order: 7, current_count: 12, percentage_of_active: 0.0, avg_dwell_hours: 0.0, avg_dwell_display: '0h' },
  ],
  bottlenecks: [
    { level: 'MANAGER', level_label: 'Central Manager', total_pending: 6, oldest_case_tracking_id: 'CSJMU-2026-00010', oldest_case_age_hours: 28.0, oldest_case_age_display: '1d 4h', avg_stage_age_hours: 4.2, avg_stage_age_display: '4h 12m', median_stage_age_hours: 3.5, median_stage_age_display: '3h 30m', max_stage_age_hours: 28.0, max_stage_age_display: '1d 4h' },
    { level: 'ASSISTANT_DEAN', level_label: 'Assistant Deans', total_pending: 14, oldest_case_tracking_id: 'CSJMU-2026-00014', oldest_case_age_hours: 96.0, oldest_case_age_display: '4d 0h', avg_stage_age_hours: 18.0, avg_stage_age_display: '18h', median_stage_age_hours: 14.0, median_stage_age_display: '14h', max_stage_age_hours: 96.0, max_stage_age_display: '4d 0h' },
    { level: 'ASSOCIATE_DEAN', level_label: 'Associate Deans', total_pending: 8, oldest_case_tracking_id: 'CSJMU-2026-00022', oldest_case_age_hours: 120.0, oldest_case_age_display: '5d 0h', avg_stage_age_hours: 26.5, avg_stage_age_display: '1d 2h', median_stage_age_hours: 22.0, median_stage_age_display: '22h', max_stage_age_hours: 120.0, max_stage_age_display: '5d 0h' },
    { level: 'DEAN', level_label: 'Dean R&D', total_pending: 3, oldest_case_tracking_id: 'CSJMU-2026-00004', oldest_case_age_hours: 48.0, oldest_case_age_display: '2d 0h', avg_stage_age_hours: 8.5, avg_stage_age_display: '8h 30m', median_stage_age_hours: 7.0, median_stage_age_display: '7h', max_stage_age_hours: 48.0, max_stage_age_display: '2d 0h' },
  ],
  aging_distribution: [
    { bucket_key: '<24h', label: '< 24 Hours', count: 12, percentage: 33.3, by_level: { ASSISTANT_DEAN: 6, MANAGER: 4, DEAN: 2 } },
    { bucket_key: '1-3d', label: '1–3 Days', count: 10, percentage: 27.8, by_level: { ASSISTANT_DEAN: 5, ASSOCIATE_DEAN: 4, FIXED_AUTHORITY: 1 } },
    { bucket_key: '4-7d', label: '4–7 Days', count: 8, percentage: 22.2, by_level: { ASSOCIATE_DEAN: 4, ASSISTANT_DEAN: 3, DEAN: 1 } },
    { bucket_key: '8-14d', label: '8–14 Days', count: 4, percentage: 11.1, by_level: { FIXED_AUTHORITY: 2, ASSOCIATE_DEAN: 2 } },
    { bucket_key: '15-30d', label: '15–30 Days', count: 2, percentage: 5.6, by_level: { ASSISTANT_DEAN: 2 } },
    { bucket_key: '30+d', label: '30+ Days', count: 0, percentage: 0.0, by_level: {} },
  ],
  authority_workloads: [
    { authority_id: 'auth-1', name: 'Dr. Ankit Trivedi', role: 'ASSISTANT_DEAN', designation: 'Assistant Dean Sciences', department_or_cluster: 'Cluster 1: Physical Sciences', assigned_count: 8, pending_count: 6, in_progress_count: 2, awaiting_info_count: 1, resolved_count: 3, escalated_count: 1, oldest_case_age_hours: 96.0, oldest_case_age_display: '4d 0h', avg_case_age_hours: 18.0, avg_case_age_display: '18h', median_case_age_hours: 14.0, median_case_age_display: '14h' },
    { authority_id: 'auth-2', name: 'Dr. Sweta Pandey', role: 'ASSOCIATE_DEAN', designation: 'Associate Dean Academic Affairs', department_or_cluster: 'Cluster 1: Academic Administration', assigned_count: 10, pending_count: 5, in_progress_count: 3, awaiting_info_count: 1, resolved_count: 4, escalated_count: 2, oldest_case_age_hours: 120.0, oldest_case_age_display: '5d 0h', avg_case_age_hours: 26.5, avg_case_age_display: '1d 2h', median_case_age_hours: 22.0, median_case_age_display: '22h' },
  ],
  assistant_dean_panel: [
    { authority_id: 'auth-1', name: 'Dr. Ankit Trivedi', subject_cluster_name: 'Physical Sciences Cluster', active_cases: 8, pending: 6, in_progress: 2, awaiting_information: 1, resolved: 3, oldest_case_display: '4d 0h', avg_pending_age_display: '18h' },
  ],
  associate_dean_panel: [
    { authority_id: 'auth-2', name: 'Dr. Sweta Pandey', grievance_cluster_name: 'Academic Discrepancies Cluster', active_cases: 10, pending: 5, in_progress: 3, awaiting_information: 1, resolved: 4, escalated_to_dean: 2, oldest_case_display: '5d 0h', avg_age_display: '1d 2h' },
  ],
  manager_triage: {
    awaiting_ai_review: 2,
    awaiting_category_ratification: 4,
    category_overridden: 3,
    category_ratified: 35,
    assigned_to_assistant_dean: 32,
    unresolved_manager_queue: 6,
    oldest_pending_manager_case: 'CSJMU-2026-00010',
    avg_manager_age_display: '4h 12m',
    ai_accuracy_percentage: 92.1,
    ai_predictions_total: 38,
    recent_overrides: [
      { grievance_id: 'CSJMU-2026-00015', title: 'Grade Discrepancy In Physics Lab', ai_predicted_category: 'Examination Delay', manager_final_category: 'Coursework & Evaluation', confidence_score: 0.65, reviewed_at: '2026-09-29T14:20:00Z' },
    ],
  },
  category_analytics: [
    { category_id: 'cat-1', category_name: 'Coursework & Evaluation', routing_type: 'CLUSTER', total_count: 24, active_count: 18, resolved_count: 6, pending_count: 12, percentage: 50.0, avg_age_hours: 22.0, avg_age_display: '22h' },
    { category_id: 'cat-2', category_name: 'Institutional Fellowship', routing_type: 'FIXED_AUTHORITY', total_count: 12, active_count: 8, resolved_count: 4, pending_count: 5, percentage: 25.0, avg_age_hours: 15.0, avg_age_display: '15h' },
  ],
  grievance_cluster_analytics: [
    { cluster_id: 'gc-1', cluster_number: 1, cluster_name: 'Academic Affairs', assigned_associate_dean_name: 'Dr. Sweta Pandey', active_count: 18, pending_count: 12, resolved_count: 6, oldest_case_display: '5d 0h', avg_age_display: '22h' },
  ],
  subject_cluster_analytics: [
    { cluster_id: 'sc-1', cluster_number: 1, cluster_name: 'Physical Sciences', assigned_assistant_dean_name: 'Dr. Ankit Trivedi', active_count: 14, pending_count: 10, resolved_count: 4, subjects: [] },
  ],
  priority_analysis: {
    counts: { CRITICAL: 3, HIGH: 4, MEDIUM: 15, LOW: 14 },
    by_authority_level: {},
  },
  time_trends: [
    { period: '24 Sep', date: '2026-09-24', submitted_count: 4, resolved_count: 2, escalated_count: 0, active_backlog: 12 },
    { period: '25 Sep', date: '2026-09-25', submitted_count: 6, resolved_count: 3, escalated_count: 1, active_backlog: 15 },
  ],
  routing_analytics: {
    by_routing_type: [
      { routing_type: 'CLUSTER', count: 24, percentage: 50.0, active_count: 18, resolved_count: 6 },
      { routing_type: 'FIXED_AUTHORITY', count: 12, percentage: 25.0, active_count: 8, resolved_count: 4 },
    ],
    transitions: [
      { transition_name: 'Assistant Dean → Associate Dean', count: 8 },
      { transition_name: 'Associate Dean → Dean R&D', count: 3 },
    ],
  },
  fixed_authorities: [
    { category_id: 'cat-2', category_name: 'Institutional Fellowship', authority_id: 'auth-fix-1', authority_name: 'Dr. Rajesh Sharma', authority_role: 'DIRECTOR', active_cases: 8, pending_cases: 5, resolved_cases: 4, oldest_case_display: '8d 0h', avg_age_display: '15h' },
  ],
  resolution_analytics: {
    total_resolved: 12,
    resolution_rate: 25.0,
    avg_lifecycle_hours: 48.5,
    avg_lifecycle_display: '2d 0h',
    resolutions_by_authority_level: { ASSISTANT_DEAN: 6, ASSOCIATE_DEAN: 4, DEAN: 2 },
    resolutions_by_category: { 'Coursework & Evaluation': 8, 'Institutional Fellowship': 4 },
    resolutions_by_cluster: { 'Academic Affairs': 12 },
  },
  oldest_cases: [
    { id: 'grv-old-1', tracking_id: 'CSJMU-2026-00004', title: 'PhD Thesis Defense Clearance Pending', submitted_at: '2026-09-15T09:00:00Z', submitted_display: '15 Sep 2026, 09:00', total_age_hours: 360.0, total_age_display: '15d 0h', current_stage_age_hours: 48.0, current_stage_age_display: '2d 0h', current_authority_name: 'Prof. Namita Tiwari', current_authority_role: 'DEAN', current_level: 'DEAN', category_name: 'Academic Affairs', subject_name: 'Physics', priority: 'HIGH', status: 'ESCALATED', last_action: 'Escalated by Associate Dean', last_action_timestamp: '2026-09-28T09:00:00Z', last_action_display: '28 Sep 2026, 09:00' },
  ],
  attention_items: [
    { id: 'grv-old-1', tracking_id: 'CSJMU-2026-00004', title: 'PhD Thesis Defense Clearance Pending', priority: 'HIGH', status: 'ESCALATED', subject_name: 'Physics', category_name: 'Academic Affairs', current_authority_name: 'Prof. Namita Tiwari', current_authority_role: 'DEAN', submitted_at: '2026-09-15T09:00:00Z', submitted_display: '15 Sep 2026, 09:00', aging_days: 15, urgency_reason: 'Escalated for Institutional Executive Ruling', escalation_count: 1 },
  ],
  recent_activities: [
    { id: 'act-1', event_type: 'ESCALATED', tracking_id: 'CSJMU-2026-00004', title: 'PhD Thesis Defense Clearance Pending', actor_name: 'Dr. Sweta Pandey', actor_role: 'ASSOCIATE_DEAN', description: 'Escalated to Dean for institutional determination', timestamp: '2026-09-28T09:00:00Z', timestamp_display: '28 Sep 2026, 09:00' },
  ],
  routing_health: {
    grievances_with_active_assignment: 36,
    grievances_without_active_assignment: 0,
    categories_missing_routing: 0,
    subjects_missing_cluster: 0,
    clusters_missing_authority: 0,
    is_healthy: true,
  },
  filters_metadata: {
    categories: [{ id: 'cat-1', name: 'Coursework & Evaluation' }, { id: 'cat-2', name: 'Institutional Fellowship' }],
    subjects: [{ id: 'sub-1', name: 'Physics', extra: 'PHY' }],
    subject_clusters: [{ id: 'sc-1', name: 'Cluster 1: Physical Sciences' }],
    grievance_clusters: [{ id: 'gc-1', name: 'Cluster 1: Academic Affairs' }],
    authorities: [{ id: 'auth-1', name: 'Dr. Ankit Trivedi', extra: 'ASSISTANT_DEAN' }],
    priorities: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    statuses: ['SUBMITTED', 'PENDING_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_INFORMATION', 'ESCALATED', 'RESOLVED', 'CLOSED'],
    levels: ['APPLICANT', 'MANAGER', 'ASSISTANT_DEAN', 'ASSOCIATE_DEAN', 'FIXED_AUTHORITY', 'DEAN', 'RESOLVED'],
    aging_buckets: ['<24h', '1-3d', '4-7d', '8-14d', '15-30d', '30+d'],
  },
};

const mockLedgerData: ExecutiveLedgerResponse = {
  items: [
    {
      id: 'grv-old-1',
      tracking_id: 'CSJMU-2026-00004',
      title: 'PhD Thesis Defense Clearance Pending',
      submitted_at: '2026-09-15T09:00:00Z',
      submitted_display: '15 Sep 2026, 09:00',
      total_age_hours: 360.0,
      total_age_display: '15d 0h',
      current_level: 'DEAN',
      current_authority_name: 'Prof. Namita Tiwari',
      current_authority_role: 'DEAN',
      category_name: 'Academic Affairs',
      subject_name: 'Physics',
      cluster_name: 'Academic Affairs',
      priority: 'HIGH',
      status: 'ESCALATED',
      current_stage_age_hours: 48.0,
      current_stage_age_display: '2d 0h',
      last_action: 'Escalated by Associate Dean',
      last_action_timestamp: '2026-09-28T09:00:00Z',
      last_action_display: '28 Sep 2026, 09:00',
    },
  ],
  total: 1,
  page: 1,
  page_size: 15,
  total_pages: 1,
};

describe('Dean Executive Command Center Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grievanceService.getDeanExecutiveDashboard).mockResolvedValue(mockDashboardData);
    vi.mocked(grievanceService.getDeanDashboardCases).mockResolvedValue(mockLedgerData);
  });

  it('1. Renders Dean Executive Command Center header, context, and refresh controls', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<DeanExecutiveDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dean Executive Command Center')).toBeInTheDocument();
      expect(screen.getByText(/CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY/i)).toBeInTheDocument();
      expect(screen.getByText(/EXECUTIVE OVERSIGHT/i)).toBeInTheDocument();
      expect(screen.getByTestId('refresh-dashboard-btn')).toBeInTheDocument();
    });
  });

  it('2. Renders all 8 Top Executive KPI cards with correct metrics', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<DeanExecutiveDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TOTAL INTAKE')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE / OPEN')).toBeInTheDocument();
      expect(screen.getByText('PENDING QUEUE')).toBeInTheDocument();
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      expect(screen.getAllByText('RESOLVED').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('ESCALATED').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('AWAITING INFO')).toBeInTheDocument();
      expect(screen.getByText('CRITICAL / URGENT')).toBeInTheDocument();

      // Check values
      expect(screen.getAllByText('48').length).toBeGreaterThanOrEqual(1); // total
      expect(screen.getAllByText('36').length).toBeGreaterThanOrEqual(1); // active
      expect(screen.getAllByText('24').length).toBeGreaterThanOrEqual(1); // pending
    });
  });

  it('3. Renders Workflow Pipeline Funnel stages with dwell times and active workload percentages', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<DeanExecutiveDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Workflow Progression & Active Pipeline')).toBeInTheDocument();
      expect(screen.getByText(/1\. Applicant Intake/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Central Manager Triage/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. Assistant Dean Redressal/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. Associate Dean Review/i)).toBeInTheDocument();
      expect(screen.getByText(/5\. Fixed Authority Redressal/i)).toBeInTheDocument();
      expect(screen.getByText(/6\. Dean Executive Decision/i)).toBeInTheDocument();
    });
  });

  it('4. Renders "Where are cases stuck?" bottleneck analysis section', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<DeanExecutiveDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Assistant Deans/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('14 Pending')).toBeInTheDocument();
      expect(screen.getAllByText(/Associate Deans/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('8 Pending')).toBeInTheDocument();
    });
  });

  it('5. Renders Pending Aging Analysis buckets with interactive click-to-filter capability', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<DeanExecutiveDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Aging Analysis (Elapsed Time)')).toBeInTheDocument();
      expect(screen.getAllByText('< 24 Hours').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('1–3 Days').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('4–7 Days').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('8–14 Days').length).toBeGreaterThanOrEqual(1);
    });

    // Clicking aging bucket triggers filter reload
    const bucketCard = screen.getByTestId('aging-bucket-8-14d');
    fireEvent.click(bucketCard);

    await waitFor(() => {
      expect(grievanceService.getDeanExecutiveDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ aging_bucket: '8-14d' })
      );
    });
  });

  it('6. Supports tabbed authority workload matrix (Assistant Deans, Associate Deans, Manager, Fixed, All)', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<DeanExecutiveDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Administrative Authority Workload Surveillance')).toBeInTheDocument();
      expect(screen.getByText('Dr. Ankit Trivedi')).toBeInTheDocument();
    });

    // Switch to Associate Deans tab
    const assocTab = screen.getByRole('button', { name: 'Associate Deans' });
    fireEvent.click(assocTab);

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Sweta Pandey').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Academic Discrepancies Cluster')).toBeInTheDocument();
    });

    // Switch to Manager Triage tab
    const mgrTab = screen.getByRole('button', { name: 'Manager Triage' });
    fireEvent.click(mgrTab);

    await waitFor(() => {
      expect(screen.getByText('Awaiting AI Review')).toBeInTheDocument();
      expect(screen.getByText('AI Accuracy %')).toBeInTheDocument();
      expect(screen.getByText('92.1%')).toBeInTheDocument();
    });
  });

  it('7. Renders Immediate Attention Required panel and Recent Activity feed', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<DeanExecutiveDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Immediate Attention Required/i)).toBeInTheDocument();
      expect(screen.getByText('Escalated for Institutional Executive Ruling')).toBeInTheDocument();
      expect(screen.getByText('Recent Institutional Activity Stream')).toBeInTheDocument();
      expect(screen.getByText('Escalated to Dean for institutional determination')).toBeInTheDocument();
    });
  });

  it('8. Renders Executive Grievance Ledger with search form and paginated rows', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
        <Routes>
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<DeanExecutiveDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Executive Grievance Ledger')).toBeInTheDocument();
      expect(screen.getAllByText('CSJMU-2026-00004').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('PhD Thesis Defense Clearance Pending')).toBeInTheDocument();
      expect(screen.getAllByText('15d 0h').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('2d 0h').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    });
  });
});
