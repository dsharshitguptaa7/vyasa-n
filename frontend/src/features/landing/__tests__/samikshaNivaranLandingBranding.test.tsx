import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from '../LandingPage';
import { AuthProvider } from '../../../context/AuthContext';

describe('VYASA Landing Page — SAMIKSHA × NIVARAN Brand Architecture Suite', () => {
  const renderLandingPage = () => {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/modules/sama-veda" element={<div data-testid="sama-dest">SAMIKSHA Portal Home</div>} />
            <Route path="/modules/sama-veda/publications" element={<div data-testid="sama-pub-dest">SAMIKSHA Publications</div>} />
            <Route path="/modules/sama-veda/bulletins" element={<div data-testid="sama-bull-dest">SAMIKSHA Bulletins</div>} />
            <Route path="/modules/sama-veda/authors" element={<div data-testid="sama-auth-dest">SAMIKSHA Directory</div>} />
            <Route path="/modules/sama-veda/certificates" element={<div data-testid="sama-cert-dest">SAMIKSHA Certificates</div>} />
            <Route path="/modules/sama-veda/cam-projects" element={<div data-testid="sama-proj-dest">SAMIKSHA Projects</div>} />
            <Route path="/modules/atharva-veda/nivaran" element={<div data-testid="nivaran-dest">NIVARAN Module Home</div>} />
            <Route path="/applicant/login" element={<div data-testid="applicant-login-dest">Applicant Login Page</div>} />
            <Route path="/phd-admission" element={<div data-testid="phd-assistant-dest">VYASA Assistant Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('1. Parent institutional ecosystem hierarchy (VYASA & CSJMU)', () => {
    renderLandingPage();

    // Top CSJMU Institutional Identity Block
    const instIdentity = screen.getByTestId('hero-institution-identity');
    expect(instIdentity).toBeInTheDocument();
    expect(instIdentity).toHaveTextContent('Chhatrapati Shahu Ji Maharaj University, Kanpur');
    expect(instIdentity).toHaveTextContent(/State University of Uttar Pradesh/i);

    // CSJMU & VYASA seals
    expect(screen.getByTestId('hero-institutional-seals')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'VYASAᴺ' })).toBeInTheDocument();
    expect(screen.getAllByText('ज्ञान से शोध तक, AI के साथ').length).toBeGreaterThan(0);

    // Verified removal of old eyebrow, slogan, and bottom badge
    expect(screen.queryByText('VYASA RESEARCH & GOVERNANCE ECOSYSTEM')).toBeNull();
    expect(screen.queryByText('One Ecosystem. Two Operational Pillars. Four Vedic Domains.')).toBeNull();
    expect(document.querySelector('.vyasa-landing-hero__floating-badge')).toBeNull();
  });

  it('2. Signature Operational Pillars: SAMIKSHA and NIVARAN side-by-side cards', () => {
    renderLandingPage();

    const samikshaCard = screen.getByTestId('service-card-samiksha');
    const nivaranCard = screen.getByTestId('service-card-nivaran');

    expect(samikshaCard).toBeInTheDocument();
    expect(nivaranCard).toBeInTheDocument();

    // SAMIKSHA card content
    expect(samikshaCard).toHaveTextContent('SAMA VEDA');
    expect(samikshaCard).toHaveTextContent('SAMIKSHA');
    expect(samikshaCard).toHaveTextContent('Research Recognition & Communication');
    expect(samikshaCard).toHaveTextContent(/Explore the university['’]s research recognition and communication ecosystem/i);

    // NIVARAN card content
    expect(nivaranCard).toHaveTextContent('ATHARVA VEDA');
    expect(nivaranCard).toHaveTextContent('NIVARAN');
    expect(nivaranCard).toHaveTextContent('Grievance Redressal & Institutional Well-Being');
    expect(nivaranCard).toHaveTextContent(/Access the university['’]s grievance redressal service/i);
  });

  it('3. SAMIKSHA Primary CTA routes to verified /modules/sama-veda route', () => {
    renderLandingPage();

    const samikshaCard = screen.getByTestId('service-card-samiksha');
    const cta = samikshaCard.querySelector('button')!;
    expect(cta).toHaveTextContent('Explore SAMIKSHA');

    fireEvent.click(cta);
    expect(screen.getByTestId('sama-dest')).toBeInTheDocument();
  });

  it('4. NIVARAN Primary CTA routes to verified /modules/atharva-veda/nivaran route', () => {
    renderLandingPage();

    const nivaranCard = screen.getByTestId('service-card-nivaran');
    const cta = nivaranCard.querySelector('button')!;
    expect(cta).toHaveTextContent('Explore NIVARAN');

    fireEvent.click(cta);
    expect(screen.getByTestId('nivaran-dest')).toBeInTheDocument();
  });

  it('5. Four Vedic Domains Architecture preserves Rig, Yajur, Sama, and Atharva', () => {
    renderLandingPage();

    expect(screen.getByRole('heading', { name: 'The Four Domains of VYASAᴺ' })).toBeInTheDocument();

    // Rig Veda & Yajur Veda remain Conceptual Domains
    expect(screen.getByRole('heading', { name: 'Rig Veda' })).toBeInTheDocument();
    expect(screen.getByText('Research & Knowledge Creation')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Yajur Veda' })).toBeInTheDocument();
    expect(screen.getByText('Research Administration & Incentives')).toBeInTheDocument();

    // Sama Veda & Atharva Veda represent operational domains
    expect(screen.getByRole('heading', { name: 'Sama Veda' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atharva Veda' })).toBeInTheDocument();
  });

  it('6. SAMIKSHA Highlight section provides verified feature navigation', () => {
    renderLandingPage();

    const samikshaSection = document.getElementById('samiksha')!;
    expect(samikshaSection).toBeInTheDocument();
    expect(samikshaSection).toHaveTextContent('SAMIKSHA');
    expect(samikshaSection).toHaveTextContent('Scholarly Publications');
    expect(samikshaSection).toHaveTextContent('Research Bulletins');
    expect(samikshaSection).toHaveTextContent('Faculty & Scholar Directory');
    expect(samikshaSection).toHaveTextContent('Certificate Verification');
    expect(samikshaSection).toHaveTextContent('Research Initiatives & Showcases');
    expect(samikshaSection).toHaveTextContent('Fellowship Schemes');

    // Click Publication link in SAMIKSHA highlight
    const pubLink = screen.getByRole('button', { name: /View Publications in SAMIKSHA/i });
    fireEvent.click(pubLink);
    expect(screen.getByTestId('sama-pub-dest')).toBeInTheDocument();
  });

  it('7. NIVARAN Highlight section presents 7-step connected workflow journey', () => {
    renderLandingPage();

    const nivaranSection = document.getElementById('nivaran')!;
    expect(nivaranSection).toBeInTheDocument();
    expect(nivaranSection).toHaveTextContent('NIVARAN');
    expect(nivaranSection).toHaveTextContent('The First Operational Domain');
    expect(nivaranSection).toHaveTextContent('Grievance Submission');
    expect(nivaranSection).toHaveTextContent('Initial Review');
    expect(nivaranSection).toHaveTextContent('AI-Assisted Processing');
    expect(nivaranSection).toHaveTextContent('Institutional Review');
    expect(nivaranSection).toHaveTextContent('Authority Workflow');
    expect(nivaranSection).toHaveTextContent('Resolution / Escalation');
    expect(nivaranSection).toHaveTextContent('Institutional Record');
  });

  it('8. Service brand is strictly NIVARAN (no NIVARAN-AI in landing branding)', () => {
    renderLandingPage();

    // Check headings and buttons for absence of NIVARAN-AI
    const h1sAndH2s = screen.getAllByRole('heading');
    h1sAndH2s.forEach((h) => {
      expect(h.textContent).not.toContain('NIVARAN-AI');
    });

    const ctas = screen.getAllByRole('button');
    ctas.forEach((b) => {
      expect(b.textContent).not.toContain('NIVARAN-AI');
    });
  });
  it('9. Sections are ordered in the exact requested institutional hierarchy', () => {
    renderLandingPage();

    const sections = Array.from(document.querySelectorAll('section'));
    expect(sections.length).toBe(11);

    // 1. VYASA Main Branding & Hero
    expect(sections[0].className).toContain('vyasa-landing-hero');

    // 2. The Vision Behind VYASA (Institutional Purpose & Leadership)
    expect(sections[1].id).toBe('vision');

    // 3. Two Operational Pillars: SAMIKSHA | NIVARAN
    expect(sections[2].id).toBe('operational-pillars');

    // 4. The Four Domains of VYASA (Institutional Architecture)
    expect(sections[3].id).toBe('domains');

    // 5. SAMIKSHA (Detailed Branding & Research Services)
    expect(sections[4].id).toBe('samiksha');

    // 6. NIVARAN (Detailed Branding & Grievance Flow)
    expect(sections[5].id).toBe('nivaran');

    // 7. From Fragmented Processes to an Integrated Ecosystem
    expect(sections[6].id).toBe('why-vyasa');

    // 8. Designed, Developed & Evolved at CSJMU Kanpur
    expect(sections[7].id).toBe('csjmu');

    // 9. One Step Toward Institutional Innovation
    expect(sections[8].id).toBe('innovation');

    // 10. Institutional Access Gateways
    expect(sections[9].id).toBe('entry-gateways');

    // 11. The Vision Continues
    expect(sections[10].id).toBe('closing');
  });
});
