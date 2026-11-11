import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminRoute } from '../../components/auth/AdminRoute';
import { AdminModuleToggleCard } from '../components/AdminModuleToggleCard';
import * as AuthContextModule from '../../context/AuthContext';

describe('ANUDAAN Phase 4.3.7 — Sadmin CMS Navigation, Routing & RBAC Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockAuthContext = (overrides = {}) => ({
    user: {
      id: 'admin-uuid-1',
      email: 'sadmin.anudaan@csjmu.ac.in',
      first_name: 'Super',
      last_name: 'Admin',
      roles: ['super_admin'],
      permissions: ['anudaan:finance:manage', 'anudaan:gallery:edit', 'anudaan:config:manage'],
    },
    token: 'valid-jwt-token',
    isAuthenticated: true,
    isLoading: false,
    isAdmin: true,
    isSuperAdmin: true,
    isAuthority: false,
    isApplicant: false,
    isManager: false,
    isAssistantDean: false,
    isAssociateDean: false,
    isDean: false,
    authorityRole: null,
    authorityId: null,
    authorityDesignation: null,
    persona: 'admin' as const,
    displayName: 'Super Administrator',
    login: vi.fn(),
    completeTwoFactorAuth: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  });

  describe('1. AdminSidebar Visibility & Navigation Hierarchy', () => {
    it('1.1 Renders ANUDAAN MANAGEMENT with sanction register and gallery for Super Admin', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(createMockAuthContext());

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminSidebar activeTab="overview" />
        </MemoryRouter>
      );

      // Section title
      expect(screen.getByText('ANUDAAN MANAGEMENT')).toBeInTheDocument();

      // Navigation items
      const impactLink = screen.getByRole('link', { name: /Incentive Sanction Register/i });
      expect(impactLink).toBeInTheDocument();
      expect(impactLink).toHaveAttribute('href', '/admin/anudaan');

      const galleryLink = screen.getByRole('link', { name: /Researcher Gallery/i });
      expect(galleryLink).toBeInTheDocument();
      expect(galleryLink).toHaveAttribute('href', '/admin/anudaan/gallery');
    });

    it('1.2 Displays ONLY Incentive Sanction Register for Finance Officer role', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        createMockAuthContext({
          isSuperAdmin: false,
          isAdmin: false,
          user: {
            id: 'finance-officer-1',
            email: 'finance.anudaan@csjmu.ac.in',
            roles: ['anudaan_finance_officer'],
            permissions: ['anudaan:finance:manage'],
          },
        })
      );

      render(
        <MemoryRouter initialEntries={['/admin/anudaan']}>
          <AdminSidebar activeTab="anudaan-impact" />
        </MemoryRouter>
      );

      expect(screen.getByText('ANUDAAN MANAGEMENT')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Incentive Sanction Register/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Researcher Gallery/i })).not.toBeInTheDocument();
    });

    it('1.3 Displays ONLY Researcher Gallery for Gallery Editor role', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        createMockAuthContext({
          isSuperAdmin: false,
          isAdmin: false,
          user: {
            id: 'gallery-editor-1',
            email: 'gallery.editor@csjmu.ac.in',
            roles: ['anudaan_gallery_editor'],
            permissions: ['anudaan:gallery:edit'],
          },
        })
      );

      render(
        <MemoryRouter initialEntries={['/admin/anudaan/gallery']}>
          <AdminSidebar activeTab="anudaan-gallery" />
        </MemoryRouter>
      );

      expect(screen.getByText('ANUDAAN MANAGEMENT')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Researcher Gallery/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Incentive Sanction Register/i })).not.toBeInTheDocument();
    });

    it('1.4 Completely hides ANUDAAN MANAGEMENT section for unauthorized authority users', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        createMockAuthContext({
          isSuperAdmin: false,
          isAdmin: false,
          isAuthority: true,
          user: {
            id: 'unauth-officer',
            email: 'officer@csjmu.ac.in',
            roles: ['authority'],
            permissions: [],
          },
        })
      );

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminSidebar />
        </MemoryRouter>
      );

      expect(screen.queryByText('ANUDAAN MANAGEMENT')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Incentive Sanction Register/i })).not.toBeInTheDocument();
    });
  });

  describe('2. Direct Route Access & RBAC Route Guard (AdminRoute)', () => {
    it('2.1 Allows authorized Super Admin to access /admin/anudaan', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(createMockAuthContext());

      render(
        <MemoryRouter initialEntries={['/admin/anudaan']}>
          <Routes>
            <Route
              path="/admin/anudaan"
              element={
                <AdminRoute
                  allowedRoles={['super_admin', 'administrator', 'anudaan_admin', 'anudaan_finance_officer']}
                  requiredPermission="anudaan:finance:manage"
                >
                  <div data-testid="impact-screen">Incentive Impact Content</div>
                </AdminRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('impact-screen')).toBeInTheDocument();
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    it('2.2 Allows delegated anudaan_finance_officer to access /admin/anudaan', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        createMockAuthContext({
          isSuperAdmin: false,
          isAdmin: false,
          user: {
            id: 'finance-officer-1',
            email: 'finance@csjmu.ac.in',
            roles: ['anudaan_finance_officer'],
            permissions: ['anudaan:finance:manage'],
          },
        })
      );

      render(
        <MemoryRouter initialEntries={['/admin/anudaan']}>
          <Routes>
            <Route
              path="/admin/anudaan"
              element={
                <AdminRoute
                  allowedRoles={['super_admin', 'administrator', 'anudaan_admin', 'anudaan_finance_officer']}
                  requiredPermission="anudaan:finance:manage"
                >
                  <div data-testid="impact-screen">Incentive Impact Content</div>
                </AdminRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('impact-screen')).toBeInTheDocument();
    });

    it('2.3 Rejects unauthorized users attempting direct URL access with Access Denied', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
        createMockAuthContext({
          isSuperAdmin: false,
          isAdmin: false,
          user: {
            id: 'unauthorized-user',
            email: 'scholar@csjmu.ac.in',
            roles: ['applicant'],
            permissions: [],
          },
        })
      );

      render(
        <MemoryRouter initialEntries={['/admin/anudaan']}>
          <Routes>
            <Route
              path="/admin/anudaan"
              element={
                <AdminRoute
                  allowedRoles={['super_admin', 'administrator', 'anudaan_admin', 'anudaan_finance_officer']}
                  requiredPermission="anudaan:finance:manage"
                >
                  <div data-testid="impact-screen">Incentive Impact Content</div>
                </AdminRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByTestId('impact-screen')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText(/Administrative Control Plane Restricted/i)).toBeInTheDocument();
    });
  });

  describe('3. AdminModuleToggleCard Active Registry Status', () => {
    it('3.1 Displays Yajur Veda as Active with ANUDAAN Console label', () => {
      render(
        <MemoryRouter>
          <AdminModuleToggleCard />
        </MemoryRouter>
      );

      expect(screen.getByText('Yajur Veda')).toBeInTheDocument();
      expect(screen.getByText('ANUDAAN Console')).toBeInTheDocument();
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });
  });
});
