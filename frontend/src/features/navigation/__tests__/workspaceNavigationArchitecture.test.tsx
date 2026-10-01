import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Navbar } from '../../../components/common/Navbar';
import { ServicesMenu } from '../../../components/common/ServicesMenu';
import { VyasaDashboardPage } from '../../dashboard/VyasaDashboardPage';
import { AppRoutes } from '../../../App';
import * as AuthContextModule from '../../../context/AuthContext';
import { getActiveServices, VYASA_SERVICES } from '../../../services/serviceRegistry';
import { grievanceService } from '../../../modules/atharva-veda/nivaran/services/grievanceService';
import { pillarService } from '../../../services/pillarService';

// Mock grievanceService & pillarService
vi.mock('../../../modules/atharva-veda/nivaran/services/grievanceService', () => ({
  grievanceService: {
    getTaxonomySubjects: vi.fn().mockResolvedValue([]),
    getTaxonomyCategories: vi.fn().mockResolvedValue([]),
    getMyGrievances: vi.fn().mockResolvedValue([]),
    getManagerTriageQueue: vi.fn().mockResolvedValue([]),
    getDeanExecutiveDashboard: vi.fn().mockResolvedValue({
      kpis: {
        total_cases: 10,
        active_cases: 8,
        pending_cases: 5,
        in_progress_cases: 3,
        resolved_cases: 2,
        closed_cases: 0,
        escalated_cases: 1,
        awaiting_info_cases: 0,
        critical_urgent_cases: 1,
        reopened_cases: 0,
        resolution_rate: 20.0,
        avg_resolution_time_hours: 24.0,
        avg_resolution_time_display: '1d',
        ai_prediction_accuracy: 95.0,
      },
      workflow_pipeline: [],
      bottlenecks: [],
      aging_distribution: [],
      authority_workloads: [],
      assistant_dean_panel: [],
      associate_dean_panel: [],
      fixed_authorities: [],
      time_trends: [],
      oldest_cases: [],
      attention_items: [],
      recent_activities: [],
      manager_triage: {
        awaiting_ai_review: 0,
        awaiting_category_ratification: 0,
        category_overridden: 0,
        category_ratified: 0,
        assigned_to_assistant_dean: 0,
        unresolved_manager_queue: 0,
        recent_overrides: [],
      },
      category_analytics: [],
      grievance_cluster_analytics: [],
      subject_cluster_analytics: [],
      priority_analysis: { counts: {}, by_authority_level: {} },
      routing_analytics: { by_routing_type: [], transitions: [] },
      resolution_analytics: {
        total_resolved: 0,
        resolution_rate: 0,
        avg_lifecycle_hours: 0,
        avg_lifecycle_display: '0h',
        resolutions_by_authority_level: {},
        resolutions_by_category: {},
        resolutions_by_cluster: {},
      },
      routing_health: {
        grievances_with_active_assignment: 0,
        grievances_without_active_assignment: 0,
        categories_missing_routing: 0,
        subjects_missing_cluster: 0,
        clusters_missing_authority: 0,
        is_healthy: true,
      },
    }),
    getDeanDashboardCases: vi.fn().mockResolvedValue({ cases: [], total: 0, page: 1, page_size: 15, total_pages: 1 }),
  },
}));

vi.mock('../../../services/pillarService', () => ({
  pillarService: {
    getPillars: vi.fn().mockResolvedValue([]),
  },
}));

describe('VYASA Services Menu & Platform UX Architecture Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockAuthHelper = (authOverrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
    const defaultAuth: AuthContextModule.AuthContextValue = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isAdmin: false,
      isAuthority: false,
      isApplicant: false,
      isManager: false,
      isAssistantDean: false,
      isAssociateDean: false,
      isDean: false,
      authorityRole: null,
      authorityId: null,
      authorityDesignation: null,
      persona: 'guest',
      displayName: 'Guest User',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      ...authOverrides,
    };

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
    return defaultAuth;
  };

  // 1. Services trigger renders
  it('1. Services trigger renders on authenticated platform header', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      isAuthority: true,
      displayName: 'Prof. Namita Tiwari',
      authorityDesignation: 'Dean R&D',
      authorityRole: 'DEAN',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /VYASA Services Menu/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Services');
  });

  // 2. Active NIVARAN-AI service exists
  it('2. Active NIVARAN-AI service exists in service registry', () => {
    const active = getActiveServices();
    const nivaran = active.find((s) => s.id === 'nivaran');

    expect(nivaran).toBeDefined();
    expect(nivaran?.name).toBe('NIVARAN-AI');
    expect(nivaran?.isActive).toBe(true);
    expect(nivaran?.moduleKey).toBe('atharva_veda_nivaran');
    expect(nivaran?.route).toBe('/modules/atharva-veda/nivaran');
  });

  // 3. NIVARAN-AI is visible in Services dropdown
  it('3. NIVARAN-AI is visible in Services dropdown upon opening', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      isAuthority: true,
      displayName: 'Prof. Namita Tiwari',
      authorityDesignation: 'Dean R&D',
      authorityRole: 'DEAN',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /VYASA Services Menu/i });
    fireEvent.click(trigger);

    expect(screen.getByText('NIVARAN-AI')).toBeInTheDocument();
    expect(screen.getByText('AI-Assisted Grievance Redressal')).toBeInTheDocument();
    expect(screen.getByText('Grievance Redressal Ecosystem')).toBeInTheDocument();
    expect(screen.getByText('Active Service')).toBeInTheDocument();
  });

  // 4. Inactive Rig Veda is not visible
  it('4. Inactive Rig Veda is not visible in active services or dropdown', () => {
    const active = getActiveServices();
    expect(active.find((s) => s.id === 'rig-veda')).toBeUndefined();

    mockAuthHelper({ isAuthenticated: true, isDean: true, displayName: 'Prof. Namita Tiwari' });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    expect(screen.queryByText('Rig Veda')).not.toBeInTheDocument();
    expect(screen.queryByText('PRAMAAN')).not.toBeInTheDocument();
  });

  // 5. Inactive Yajur Veda is not visible
  it('5. Inactive Yajur Veda is not visible in active services or dropdown', () => {
    const active = getActiveServices();
    expect(active.find((s) => s.id === 'yajur-veda')).toBeUndefined();

    mockAuthHelper({ isAuthenticated: true, isDean: true, displayName: 'Prof. Namita Tiwari' });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    expect(screen.queryByText('Yajur Veda')).not.toBeInTheDocument();
    expect(screen.queryByText('ANUDAN')).not.toBeInTheDocument();
  });

  // 6. Inactive Sama Veda is not visible
  it('6. Inactive Sama Veda is not visible in active services or dropdown', () => {
    const active = getActiveServices();
    expect(active.find((s) => s.id === 'sama-veda')).toBeUndefined();

    mockAuthHelper({ isAuthenticated: true, isDean: true, displayName: 'Prof. Namita Tiwari' });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    expect(screen.queryByText('Sama Veda')).not.toBeInTheDocument();
    expect(screen.queryByText('SAMIKSHA')).not.toBeInTheDocument();
  });

  // 7. Mouse enter opens Services
  it('7. Mouse enter opens Services dropdown without requiring a click on desktop', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
      authorityDesignation: 'Dean R&D',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ServicesMenu />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /VYASA Services Menu/i });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Hover mouse over Services
    fireEvent.mouseEnter(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('NIVARAN-AI')).toBeInTheDocument();
  });

  // 8. Mouse remains inside dropdown without closing
  it('8. Mouse moving from trigger into dropdown panel keeps menu open', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ServicesMenu />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /VYASA Services Menu/i });
    fireEvent.mouseEnter(trigger);

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();

    // Mouse enters menu
    fireEvent.mouseEnter(menu);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  // 9. Mouse leaves combined region and dropdown closes
  it('9. Mouse leaving combined region closes dropdown after safe debounce delay', async () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ServicesMenu />
      </MemoryRouter>
    );

    const menuWrapper = container.querySelector('.vyasa-services-menu')!;
    fireEvent.mouseEnter(menuWrapper);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Pointer leaves the combined region
    fireEvent.mouseLeave(menuWrapper);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  // 10. Clicking NIVARAN-AI navigates correctly
  it('10. Clicking NIVARAN-AI navigates directly and closes dropdown', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      isAuthority: true,
      authorityRole: 'DEAN',
      displayName: 'Prof. Namita Tiwari',
      user: { id: 'dean-1', email: 'namita@csjmu.ac.in', roles: ['authority'], authority_role: 'DEAN' },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Navbar />} />
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<div>Target Dean Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    const nivaranItem = screen.getByRole('menuitem');
    fireEvent.click(nivaranItem);

    expect(screen.getByText('Target Dean Dashboard')).toBeInTheDocument();
  });

  // 11. Applicant destination works
  it('11. Applicant destination routes directly to Applicant grievance list', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isApplicant: true,
      displayName: 'Aditi Sharma',
      user: { id: 'app-1', email: 'scholar@csjmu.ac.in', roles: ['applicant'] },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ServicesMenu />} />
          <Route path="/modules/atharva-veda/nivaran/my-grievances" element={<div>Target Scholar Grievances</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    fireEvent.click(screen.getByRole('menuitem'));

    expect(screen.getByText('Target Scholar Grievances')).toBeInTheDocument();
  });

  // 12. Manager destination works
  it('12. Manager destination routes directly to Manager triage queue', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isAuthority: true,
      isManager: true,
      authorityRole: 'MANAGER',
      displayName: 'Rajiv Malhotra',
      user: { id: 'mgr-1', email: 'mgr@csjmu.ac.in', roles: ['authority'], authority_role: 'MANAGER' },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ServicesMenu />} />
          <Route path="/modules/atharva-veda/nivaran/manager/queue" element={<div>Target Manager Queue</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    fireEvent.click(screen.getByRole('menuitem'));

    expect(screen.getByText('Target Manager Queue')).toBeInTheDocument();
  });

  // 13. Assistant Dean destination works
  it('13. Assistant Dean destination routes directly to Assistant Dean dashboard', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isAuthority: true,
      isAssistantDean: true,
      authorityRole: 'ASSISTANT_DEAN',
      displayName: 'Dr. Ankit Trivedi',
      user: { id: 'asst-1', email: 'asst@csjmu.ac.in', roles: ['authority'], authority_role: 'ASSISTANT_DEAN' },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ServicesMenu />} />
          <Route path="/modules/atharva-veda/nivaran/assistant-dean/dashboard" element={<div>Target Assistant Dean Docket</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    fireEvent.click(screen.getByRole('menuitem'));

    expect(screen.getByText('Target Assistant Dean Docket')).toBeInTheDocument();
  });

  // 14. Associate Dean destination works
  it('14. Associate Dean destination routes directly to Associate Dean dashboard', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isAuthority: true,
      isAssociateDean: true,
      authorityRole: 'ASSOCIATE_DEAN',
      displayName: 'Dr. Sweta Pandey',
      user: { id: 'assoc-1', email: 'assoc@csjmu.ac.in', roles: ['authority'], authority_role: 'ASSOCIATE_DEAN' },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ServicesMenu />} />
          <Route path="/modules/atharva-veda/nivaran/associate-dean/dashboard" element={<div>Target Associate Dean Docket</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    fireEvent.click(screen.getByRole('menuitem'));

    expect(screen.getByText('Target Associate Dean Docket')).toBeInTheDocument();
  });

  // 15. Dean destination works
  it('15. Dean destination routes directly to Dean Executive Command Center', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isAuthority: true,
      isDean: true,
      authorityRole: 'DEAN',
      displayName: 'Prof. Namita Tiwari',
      user: { id: 'dean-1', email: 'namita@csjmu.ac.in', roles: ['authority'], authority_role: 'DEAN' },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<ServicesMenu />} />
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<div>Target Dean Command Center</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    fireEvent.click(screen.getByRole('menuitem'));

    expect(screen.getByText('Target Dean Command Center')).toBeInTheDocument();
  });

  // 16. Escape closes menu
  it('16. Pressing Escape closes the open Services menu and returns focus to trigger', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ServicesMenu />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /VYASA Services Menu/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // 17. Outside click closes menu
  it('17. Clicking outside the Services menu closes it', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <div>
          <span data-testid="outside-area">Outside Content</span>
          <ServicesMenu />
        </div>
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /VYASA Services Menu/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // 18. Keyboard access works
  it('18. Keyboard Enter and Space toggle the Services menu', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ServicesMenu />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /VYASA Services Menu/i });

    // Open via Enter key
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Close via Space key
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // 19. Mobile/touch fallback works
  it('19. Mobile/touch tap toggles the Services menu without relying on hover', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ServicesMenu />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /VYASA Services Menu/i });

    // Tap to open
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Tap to close
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // 20. Dropdown does not cause horizontal overflow
  it('20. Dropdown overlay does not force horizontal scroll or clip in parent navigation', () => {
    mockAuthHelper({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    const nav = container.querySelector('nav[aria-label="Platform navigation"]');
    expect(nav).toBeInTheDocument();

    // Nav must have overflow: visible and position: relative to prevent horizontal scrollbars
    expect(nav).toHaveStyle({ overflow: 'visible' });

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: /VYASA Services Menu/i }));
    const menu = screen.getByRole('menu');

    // Menu must be an overlay with absolute positioning
    expect(menu).toHaveStyle({ position: 'absolute' });
  });
});
