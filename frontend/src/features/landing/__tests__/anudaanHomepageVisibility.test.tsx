import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LandingPage } from '../LandingPage';
import { PublicNavbar } from '../../../components/common/PublicNavbar';
import * as AuthContextModule from '../../../context/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ANUDAAN Complete Homepage Visibility & Navbar Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      displayName: '',
      isApplicant: false,
      isAuthority: false,
      isDean: false,
      isAdmin: false,
      isSuperAdmin: false,
      logout: vi.fn(),
    } as any);
  });

  const renderLanding = () => {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );
  };

  const renderNavbar = () => {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <PublicNavbar currentTab="overview" />
      </MemoryRouter>
    );
  };

  describe('1. Navbar Integration (Desktop & Mobile)', () => {
    it('1.1 Desktop navbar displays ANUDAAN with Live badge between SAMIKSHA and Research & Innovation', () => {
      renderNavbar();

      const navList = screen.getByRole('navigation', { name: /Ecosystem section navigation/i });
      const links = Array.from(navList.querySelectorAll('button'));
      const linkLabels = links.map((l) => l.textContent);

      expect(linkLabels).toContain('Overview');
      expect(linkLabels).toContain('The Vision');
      expect(linkLabels).toContain('Four Domains');
      expect(linkLabels.some((l) => l?.startsWith('NIVARAN'))).toBe(true);
      expect(linkLabels).toContain('SAMIKSHA');
      expect(linkLabels.some((l) => l?.startsWith('ANUDAAN'))).toBe(true);
      expect(linkLabels).toContain('Research & Innovation');

      const samikshaIdx = linkLabels.indexOf('SAMIKSHA');
      const anudaanIdx = linkLabels.findIndex((l) => l?.startsWith('ANUDAAN'));
      const innovationIdx = linkLabels.indexOf('Research & Innovation');

      expect(samikshaIdx).toBeGreaterThan(-1);
      expect(anudaanIdx).toBe(samikshaIdx + 1);
      expect(innovationIdx).toBe(anudaanIdx + 1);
    });

    it('1.2 Clicking ANUDAAN in the desktop navbar navigates to /modules/yajur-veda/anudaan', () => {
      renderNavbar();

      const anudaanBtn = screen.getAllByRole('button', { name: /^ANUDAAN/i })[0];
      expect(anudaanBtn).toBeInTheDocument();

      fireEvent.click(anudaanBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');
    });

    it('1.3 Mobile navigation drawer includes ANUDAAN and navigates on click', () => {
      renderNavbar();

      const mobileToggle = screen.getByLabelText(/Toggle navigation menu/i);
      fireEvent.click(mobileToggle);

      const drawer = screen.getByTestId('mobile-nav-drawer');
      expect(drawer.className).toContain('is-open');

      const mobileAnudaanBtn = Array.from(drawer.querySelectorAll('button')).find((b) =>
        b.textContent?.startsWith('ANUDAAN')
      );
      expect(mobileAnudaanBtn).toBeDefined();

      fireEvent.click(mobileAnudaanBtn!);
      expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');
    });

    it('1.4 Unauthenticated Login and Register dropdowns remain intact in navbar', () => {
      renderNavbar();

      expect(screen.getByRole('button', { name: /LOGIN/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /REGISTER/i })).toBeInTheDocument();
    });
  });

  describe('2. Dedicated ANUDAAN Homepage Showcase Section', () => {
    it('2.1 Renders dedicated ANUDAAN showcase with official Yajur Veda eyebrow and title', () => {
      renderLanding();

      const anudaanSection = document.getElementById('anudaan')!;
      expect(anudaanSection).toBeInTheDocument();
      expect(anudaanSection).toHaveAttribute('aria-label', 'ANUDAAN Operational System');

      // Eyebrow
      expect(anudaanSection).toHaveTextContent(/YAJUR VEDA\s+[•·]\s+OPERATIONAL SYSTEM/i);

      // Title & Subtitle
      expect(screen.getByRole('heading', { level: 2, name: 'ANUDAAN' })).toBeInTheDocument();
      expect(
        screen.getByText('Research Publication Incentive Management System')
      ).toBeInTheDocument();
    });

    it('2.2 Displays accurate institutional description and supporting workflow copy', () => {
      renderLanding();

      const anudaanSection = document.getElementById('anudaan')!;
      expect(anudaanSection).toHaveTextContent(
        /ANUDAAN is an institutional initiative of Chhatrapati Shahu Ji Maharaj University, Kanpur, designed to facilitate research publication incentive applications/i
      );
      expect(anudaanSection).toHaveTextContent(
        /An integrated digital workflow for research publication claims, author attribution, publication verification, supporting documentation and institutional incentive processing/i
      );
    });

    it('2.3 Displays the three eligible applicant categories (Campus Faculty, Scholars, Post-Docs)', () => {
      renderLanding();

      const anudaanSection = document.getElementById('anudaan')!;
      expect(anudaanSection).toHaveTextContent('CSJMU Campus Faculty');
      expect(anudaanSection).toHaveTextContent('CSJMU Campus Registered Research Scholars');
      expect(anudaanSection).toHaveTextContent('CSJMU Campus Post-Doctoral Researchers');
      expect(anudaanSection).toHaveTextContent(/Campus Units Only/i);
    });

    it('2.4 Displays 7-Stage Connected Workflow Pipeline Panel', () => {
      renderLanding();

      const pipeline = document.querySelector('.vyasa-anudaan-pipeline')!;
      expect(pipeline).toBeInTheDocument();
      expect(pipeline).toHaveTextContent('Incentive Processing Journey');
      expect(pipeline).toHaveTextContent('7 Connected Stages');

      expect(pipeline).toHaveTextContent('Applicant Profile');
      expect(pipeline).toHaveTextContent('Publication Details');
      expect(pipeline).toHaveTextContent('Author Attribution');
      expect(pipeline).toHaveTextContent('Bank Mapping');
      expect(pipeline).toHaveTextContent('Supporting Documents');
      expect(pipeline).toHaveTextContent('Institutional Verification');
      expect(pipeline).toHaveTextContent('Incentive Processing');
    });

    it('2.5 Primary CTA "Explore ANUDAAN" navigates to /modules/yajur-veda/anudaan', () => {
      renderLanding();

      const anudaanSection = document.getElementById('anudaan')!;
      const primaryCta = within(anudaanSection).getByRole('button', { name: /^Explore ANUDAAN$/i });
      expect(primaryCta).toBeInTheDocument();

      fireEvent.click(primaryCta);
      expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');
    });

    it('2.6 Secondary CTA "View Eligibility & Guidelines" navigates to /modules/yajur-veda/anudaan', () => {
      renderLanding();

      const secondaryCta = screen.getByRole('button', { name: /View Eligibility/i });
      expect(secondaryCta).toBeInTheDocument();

      fireEvent.click(secondaryCta);
      expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');
    });
  });

  describe('3. Institutional Architecture & Hierarchy Invariants', () => {
    it('3.1 Three Operational Pillars section renders SAMIKSHA, NIVARAN, and ANUDAAN', () => {
      renderLanding();

      const pillarsSection = document.getElementById('operational-pillars')!;
      expect(pillarsSection).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: /Three Operational Pillars\. One Unified Ecosystem\./i,
        })
      ).toBeInTheDocument();

      // Three signature pillar cards
      expect(document.querySelector('.vyasa-pillar-card--samiksha')).toBeInTheDocument();
      expect(document.querySelector('.vyasa-pillar-card--nivaran')).toBeInTheDocument();
      expect(document.querySelector('.vyasa-pillar-card--anudaan')).toBeInTheDocument();
    });

    it('3.2 Four Domains section preserves all four Vedas with ANUDAAN Yajur Veda card intact', () => {
      renderLanding();

      const domainsSection = document.getElementById('domains')!;
      expect(domainsSection).toBeInTheDocument();

      expect(screen.getByRole('heading', { level: 3, name: 'Rig Veda' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Sama Veda' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Yajur Veda' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Atharva Veda' })).toBeInTheDocument();

      // Four Domains Yajur Veda CTA button exists and works
      const fourDomainsAnudaanBtn = screen.getByRole('button', {
        name: /Open Yajur Veda \/ ANUDAAN/i,
      });
      expect(fourDomainsAnudaanBtn).toBeInTheDocument();

      fireEvent.click(fourDomainsAnudaanBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');
    });

    it('3.3 SAMIKSHA and NIVARAN dedicated showcase sections render cleanly', () => {
      renderLanding();

      const samikshaSection = document.getElementById('samiksha')!;
      expect(samikshaSection).toBeInTheDocument();
      expect(samikshaSection).toHaveTextContent('SAMIKSHA');

      const nivaranSection = document.getElementById('nivaran')!;
      expect(nivaranSection).toBeInTheDocument();
      expect(nivaranSection).toHaveTextContent('NIVARAN');
    });

    it('3.4 Sections follow the approved 12-section institutional order', () => {
      renderLanding();

      const sections = Array.from(document.querySelectorAll('section'));
      expect(sections.length).toBe(12);

      // 1. Hero
      expect(sections[0].className).toContain('vyasa-landing-hero');
      // 2. The Vision Behind VYASA
      expect(sections[1].id).toBe('vision');
      // 3. Two Operational Pillars
      expect(sections[2].id).toBe('operational-pillars');
      // 4. Four Domains of VYASA
      expect(sections[3].id).toBe('domains');
      // 5. ANUDAAN Dedicated Showcase
      expect(sections[4].id).toBe('anudaan');
      // 6. SAMIKSHA Dedicated Showcase
      expect(sections[5].id).toBe('samiksha');
      // 7. NIVARAN Dedicated Showcase
      expect(sections[6].id).toBe('nivaran');
      // 8. Integrated Ecosystem
      expect(sections[7].id).toBe('why-vyasa');
      // 9. Built at CSJMU
      expect(sections[8].id).toBe('csjmu');
      // 10. Research Innovation
      expect(sections[9].id).toBe('innovation');
      // 11. Entry Gateways
      expect(sections[10].id).toBe('entry-gateways');
      // 12. Final Vision Closing
      expect(sections[11].id).toBe('closing');
    });
  });
});
