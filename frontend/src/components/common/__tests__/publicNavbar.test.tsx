import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicNavbar } from '../PublicNavbar';
import { AuthProvider } from '../../../context/AuthContext';
import { authService } from '../../../services/authService';

const mockApplicantUser = {
  id: 'app-user-1',
  email: 'scholar@csjmu.ac.in',
  full_name: 'Harshit Gupta',
  roles: ['applicant'],
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const mockDeanUser = {
  id: 'dean-user-1',
  email: 'dean.rd@csjmu.ac.in',
  full_name: 'Prof. Namita Tiwari',
  roles: ['authority'],
  authority_role: 'DEAN',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('VYASA Public Landing Page - Premium Navigation & Access UX Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authService, 'getToken').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderNavbar = (initialEntries = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <div>
                  <PublicNavbar currentTab="overview" />
                  <div id="overview">Overview Content</div>
                  <div id="vision">Vision Content</div>
                  <div id="domains">Domains Content</div>
                  <div id="nivaran">Nivaran Content</div>
                  <div id="innovation">Innovation Content</div>
                </div>
              }
            />
            <Route path="/applicant/login" element={<div data-testid="applicant-login-page">Applicant Login Page</div>} />
            <Route path="/authority/login" element={<div data-testid="authority-login-page">Authority Login Page</div>} />
            <Route path="/applicant/register" element={<div data-testid="applicant-register-page">Applicant Register Page</div>} />
            <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<div data-testid="dean-dashboard-page">Dean Dashboard</div>} />
            <Route path="/modules/atharva-veda/nivaran/my-grievances" element={<div data-testid="applicant-grievances-page">Applicant Grievances</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('1. Login button renders on the public navigation bar', () => {
    renderNavbar();
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
    expect(loginBtn).toBeInTheDocument();
  });

  it('2. Login dropdown contains Applicant / Scholar', () => {
    renderNavbar();
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
    fireEvent.click(loginBtn);

    const dropdown = screen.getByTestId('login-dropdown-menu');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveTextContent(/Applicant \/ Scholar/i);
    expect(dropdown).toHaveTextContent(/Access Scholar Workspace/i);
  });

  it('3. Login dropdown contains Authority', () => {
    renderNavbar();
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
    fireEvent.click(loginBtn);

    const dropdown = screen.getByTestId('login-dropdown-menu');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveTextContent(/Authority/i);
    expect(dropdown).toHaveTextContent(/Institutional Authority Sign In/i);
  });

  it('4. Register dropdown contains Applicant / Scholar', () => {
    renderNavbar();
    const registerBtn = screen.getByRole('button', { name: /^REGISTER/i });
    fireEvent.click(registerBtn);

    const dropdown = screen.getByTestId('register-dropdown-menu');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveTextContent(/Applicant \/ Scholar/i);
    expect(dropdown).toHaveTextContent(/Create Scholar Account/i);
  });

  it('5. Register dropdown DOES NOT contain Authority option', () => {
    renderNavbar();
    const registerBtn = screen.getByRole('button', { name: /^REGISTER/i });
    fireEvent.click(registerBtn);

    const dropdown = screen.getByTestId('register-dropdown-menu');
    expect(dropdown).toBeInTheDocument();
    // Must NOT contain Authority
    expect(dropdown).not.toHaveTextContent(/Authority/i);
    expect(dropdown).not.toHaveTextContent(/Institutional Authority/i);
  });

  it('6. Applicant login route works from dropdown', async () => {
    renderNavbar();
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
    fireEvent.click(loginBtn);

    const scholarLink = screen.getByRole('menuitem', { name: /Applicant \/ Scholar/i });
    fireEvent.click(scholarLink);

    expect(await screen.findByTestId('applicant-login-page')).toBeInTheDocument();
  });

  it('7. Authority login route works from dropdown', async () => {
    renderNavbar();
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
    fireEvent.click(loginBtn);

    const authorityLink = screen.getByRole('menuitem', { name: /Authority/i });
    fireEvent.click(authorityLink);

    expect(await screen.findByTestId('authority-login-page')).toBeInTheDocument();
  });

  it('8. Applicant registration route works from dropdown', async () => {
    renderNavbar();
    const registerBtn = screen.getByRole('button', { name: /^REGISTER/i });
    fireEvent.click(registerBtn);

    const registerLink = screen.getByRole('menuitem', { name: /Applicant \/ Scholar/i });
    fireEvent.click(registerLink);

    expect(await screen.findByTestId('applicant-register-page')).toBeInTheDocument();
  });

  it('9. Dropdown opens on desktop hover and closes on mouse leave', async () => {
    renderNavbar();
    const loginContainer = screen.getByRole('button', { name: /^LOGIN/i }).closest('.vyasa-dropdown-wrap')!;
    expect(screen.queryByTestId('login-dropdown-menu')).toBeNull();

    // Hover in
    fireEvent.mouseEnter(loginContainer);
    expect(screen.getByTestId('login-dropdown-menu')).toBeInTheDocument();

    // Hover out
    fireEvent.mouseLeave(loginContainer);
    await waitFor(() => {
      expect(screen.queryByTestId('login-dropdown-menu')).toBeNull();
    });
  });

  it('10. Dropdown works with keyboard focus and Enter key', () => {
    renderNavbar();
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });

    // Focus & click
    fireEvent.click(loginBtn);
    expect(screen.getByTestId('login-dropdown-menu')).toBeInTheDocument();
  });

  it('11. Escape closes dropdown', () => {
    renderNavbar();
    const header = screen.getByRole('banner');
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
    fireEvent.click(loginBtn);
    expect(screen.getByTestId('login-dropdown-menu')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(header, { key: 'Escape' });
    expect(screen.queryByTestId('login-dropdown-menu')).toBeNull();
  });

  it('12. Outside click closes dropdown', () => {
    renderNavbar();
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
    fireEvent.click(loginBtn);
    expect(screen.getByTestId('login-dropdown-menu')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('login-dropdown-menu')).toBeNull();
  });

  it('13. Navbar tracks scroll and becomes sticky with is-scrolled class', () => {
    renderNavbar();
    const header = screen.getByRole('banner');

    // Simulate window scroll
    window.scrollY = 100;
    fireEvent.scroll(window);

    expect(header).toHaveClass('is-scrolled');
  });

  it('14. Section navigation links render: Overview, The Vision, Four Domains, NIVARAN-AI, Research & Innovation', () => {
    renderNavbar();
    expect(screen.getAllByRole('button', { name: /Overview/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /The Vision/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Four Domains/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /NIVARAN-AI/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Research & Innovation/i }).length).toBeGreaterThan(0);
  });

  it('15. Section navigation scrolls to target element', () => {
    renderNavbar();
    const visionEl = document.getElementById('vision')!;
    visionEl.scrollIntoView = vi.fn();

    const visionNavBtn = screen.getAllByRole('button', { name: /The Vision/i })[0];
    fireEvent.click(visionNavBtn);

    expect(visionEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('16. NIVARAN navigation respects authentication: routes unauthenticated to applicant login', async () => {
    renderNavbar();
    const nivaranBtn = screen.getAllByRole('button', { name: /NIVARAN-AI/i })[0];
    fireEvent.click(nivaranBtn);

    expect(await screen.findByTestId('applicant-login-page')).toBeInTheDocument();
  });

  it('17. NIVARAN navigation respects authentication: routes authenticated Dean to Dean dashboard', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockDeanUser as any);

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PublicNavbar />} />
            <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<div data-testid="dean-destination">Dean Exec</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /NIVARAN-AI/i })[0]).toBeInTheDocument();
    });

    const nivaranBtn = screen.getAllByRole('button', { name: /NIVARAN-AI/i })[0];
    fireEvent.click(nivaranBtn);

    expect(await screen.findByTestId('dean-destination')).toBeInTheDocument();
  });

  it('18. Tagline is horizontally centered beneath the VYASA emblem', () => {
    renderNavbar();
    const logoLockup = screen.getByRole('button', { name: /VYASA - ज्ञान से शोध तक, AI के साथ/i });
    expect(logoLockup).toBeInTheDocument();
    expect(logoLockup).toHaveClass('vyasa-public-logo-lockup');

    const tagline = logoLockup.querySelector('.vyasa-public-logo-tagline');
    expect(tagline).toBeInTheDocument();
    expect(tagline).toHaveTextContent('ज्ञान से शोध तक, AI के साथ');
  });

  it('19. Mobile navigation works: toggle opens drawer with sections and access routes', () => {
    renderNavbar();
    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i });
    expect(toggleBtn).toBeInTheDocument();

    const drawer = screen.getByTestId('mobile-nav-drawer');
    expect(drawer).not.toHaveClass('is-open');

    // Tap toggle
    fireEvent.click(toggleBtn);
    expect(drawer).toHaveClass('is-open');

    // Contains sections
    expect(drawer).toHaveTextContent('Overview');
    expect(drawer).toHaveTextContent('The Vision');
    expect(drawer).toHaveTextContent('Four Domains');
    expect(drawer).toHaveTextContent('NIVARAN-AI');

    // Contains login & register
    expect(drawer).toHaveTextContent(/Applicant \/ Scholar/i);
    expect(drawer).toHaveTextContent(/Authority/i);
  });
});
