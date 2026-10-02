import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from '../LandingPage';
import { AuthProvider } from '../../../context/AuthContext';

describe('VYASA Public Landing Page - Institutional Vision Story Suite', () => {
  const renderLandingPage = () => {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/applicant/login" element={<div data-testid="applicant-login-dest">Applicant Login Page</div>} />
            <Route path="/authority/login" element={<div data-testid="authority-login-dest">Authority Login Page</div>} />
            <Route path="/modules/atharva-veda/nivaran" element={<div data-testid="nivaran-dest">NIVARAN Module</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('1. Public landing page renders cleanly', () => {
    const { container } = renderLandingPage();
    expect(container).toBeInTheDocument();
  });

  it('2. Hero renders correctly with VYASA, Hindi tagline, and institutional statement', () => {
    renderLandingPage();

    // Wordmark & Hindi Tagline
    const title = screen.getByRole('heading', { level: 1, name: 'VYASA' });
    expect(title).toBeInTheDocument();
    expect(screen.getAllByText('ज्ञान से शोध तक, AI के साथ').length).toBeGreaterThan(0);

    // Institutional secondary description
    expect(
      screen.getByText(/An AI-assisted Research, Innovation & Institutional Governance Ecosystem/i)
    ).toBeInTheDocument();

    // Supporting statement with secure
    expect(
      screen.getByText(/A step toward making Research & Development more connected, transparent, secure, intelligent and responsive/i)
    ).toBeInTheDocument();

    // Primary CTA
    expect(screen.getAllByRole('button', { name: /Enter VYASA Ecosystem/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Explore the Vision/i })).toBeInTheDocument();
  });

  it('2b. Institutional logos (CSJMU and VYASA) are visually balanced with centered divider', () => {
    renderLandingPage();

    const sealsContainer = screen.getByTestId('hero-institutional-seals');
    expect(sealsContainer).toBeInTheDocument();

    // Verify CSJMU seal container and rendered properties
    const csjmuWrap = sealsContainer.querySelector('.vyasa-landing-hero__seal-wrap--csjmu');
    expect(csjmuWrap).toBeInTheDocument();
    const csjmuImg = csjmuWrap?.querySelector('img');
    expect(csjmuImg).toBeInTheDocument();
    expect(csjmuImg).toHaveAttribute('alt', 'Chhatrapati Shahu Ji Maharaj University, Kanpur');

    // Verify VYASA emblem container and rendered properties
    const vyasaWrap = sealsContainer.querySelector('.vyasa-landing-hero__seal-wrap--vyasa');
    expect(vyasaWrap).toBeInTheDocument();
    const vyasaImg = vyasaWrap?.querySelector('img');
    expect(vyasaImg).toBeInTheDocument();
    expect(vyasaImg).toHaveAttribute('alt', 'VYASA');

    // Verify vertical divider between the two institutional marks
    const divider = sealsContainer.querySelector('.vyasa-landing-hero__divider');
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveAttribute('aria-hidden', 'true');
  });

  it('3. Vision section renders institutional narrative with Prof. Namita Tiwari without standalone attribution', () => {
    renderLandingPage();

    // Vision Heading
    const visionHeading = screen.getByRole('heading', { name: 'The Vision Behind VYASA' });
    expect(visionHeading).toBeInTheDocument();

    // Vision narrative mentioning Prof. Namita Tiwari
    expect(screen.getByText(/Prof\. Namita Tiwari/i)).toBeInTheDocument();
    expect(screen.getByText(/Dean, Research & Development/i)).toBeInTheDocument();

    // Vision container itself should not have the attribution block
    const visionSection = visionHeading.closest('section');
    expect(visionSection?.querySelector('[data-testid="vyasa-attribution"]')).toBeNull();

    // No oversized legacy card text remains
    expect(screen.queryByText('A Small Step Toward This Vision')).toBeNull();
  });

  it('4. The Four Domains of VYASA render around central hub', () => {
    renderLandingPage();

    expect(screen.getByRole('heading', { name: 'The Four Domains of VYASA' })).toBeInTheDocument();
    expect(
      screen.getByText(/The ecosystem has been conceptually organized around the four Vedas/i)
    ).toBeInTheDocument();

    // Central hub designation
    expect(screen.getByText('Institutional Core Hub')).toBeInTheDocument();
  });

  it('5. Rig Veda is explicitly represented as Conceptual Domain / Future Development', () => {
    renderLandingPage();

    expect(screen.getByRole('heading', { name: 'Rig Veda' })).toBeInTheDocument();
    expect(screen.getByText('Research & Knowledge Creation')).toBeInTheDocument();
    expect(screen.getByText(/The research and knowledge creation dimension/i)).toBeInTheDocument();
    expect(screen.getAllByText('Conceptual Domain').length).toBeGreaterThanOrEqual(1);
  });

  it('6. Yajur Veda is explicitly represented as Conceptual Domain / Future Development', () => {
    renderLandingPage();

    expect(screen.getByRole('heading', { name: 'Yajur Veda' })).toBeInTheDocument();
    expect(screen.getByText('Research Administration & Incentives')).toBeInTheDocument();
    expect(screen.getByText(/The administrative and institutional support dimension/i)).toBeInTheDocument();
  });

  it('7. Sama Veda is explicitly represented as Conceptual Domain / Future Development', () => {
    renderLandingPage();

    expect(screen.getByRole('heading', { name: 'Sama Veda' })).toBeInTheDocument();
    expect(screen.getByText('Research Recognition & Communication')).toBeInTheDocument();
    expect(screen.getByText(/The recognition, communication and dissemination dimension/i)).toBeInTheDocument();
  });

  it('8. Atharva Veda is explicitly represented as Operational Domain', () => {
    renderLandingPage();

    expect(screen.getByRole('heading', { name: 'Atharva Veda' })).toBeInTheDocument();
    expect(screen.getByText('Grievance Redressal & Institutional Well-Being')).toBeInTheDocument();
    expect(screen.getByText('Operational Domain')).toBeInTheDocument();
  });

  it('9. NIVARAN-AI operational domain section renders workflow visual and working CTA', () => {
    renderLandingPage();

    // Operational domain banner
    expect(screen.getByText('The First Operational Domain')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'NIVARAN-AI' })).toBeInTheDocument();
    expect(screen.getByText('AI-Assisted Grievance Redressal & Monitoring')).toBeInTheDocument();

    // Workflow steps
    expect(screen.getByText('Scholar')).toBeInTheDocument();
    expect(screen.getByText('AI-Assisted Processing')).toBeInTheDocument();
    expect(screen.getByText('Institutional Review')).toBeInTheDocument();
    expect(screen.getByText('Authority Workflow')).toBeInTheDocument();
    expect(screen.getByText('Resolution / Escalation')).toBeInTheDocument();
    expect(screen.getByText('Institutional Record')).toBeInTheDocument();

    // Click CTA to navigate
    const ctas = screen.getAllByRole('button', { name: /Explore NIVARAN-AI/i });
    expect(ctas.length).toBeGreaterThan(0);
    fireEvent.click(ctas[0]);
    expect(screen.getByTestId('nivaran-dest')).toBeInTheDocument();
  });

  it('10. No generic Pillar 1/2/3/4 placeholders or Modular University Pillars remain', () => {
    renderLandingPage();

    expect(screen.queryByText(/Pillar 1/i)).toBeNull();
    expect(screen.queryByText(/Pillar 2/i)).toBeNull();
    expect(screen.queryByText(/Pillar 3/i)).toBeNull();
    expect(screen.queryByText(/Pillar 4/i)).toBeNull();
    expect(screen.queryByText('Modular University Pillars')).toBeNull();
    expect(screen.queryByText('The Four Cornerstones of VYASA')).toBeNull();
  });

  it('11. From Fragmented Processes to Integrated Ecosystem (Why VYASA) renders 4 core tenets', () => {
    renderLandingPage();

    expect(
      screen.getByRole('heading', { name: 'From Fragmented Processes to an Integrated Ecosystem' })
    ).toBeInTheDocument();

    expect(screen.getByText('RESEARCH')).toBeInTheDocument();
    expect(screen.getByText('GOVERNANCE')).toBeInTheDocument();
    expect(screen.getByText('TRANSPARENCY')).toBeInTheDocument();
    expect(screen.getByText('INTELLIGENCE')).toBeInTheDocument();
  });

  it('12. Designed, Developed & Evolved at CSJMU Kanpur section renders institutional context and relocated subtle attribution', () => {
    renderLandingPage();

    expect(
      screen.getByRole('heading', { name: /Designed, Developed & Evolved at CSJMU Kanpur/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Conceived and nurtured within the University's own research and governance fabric/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/VYASA is being envisioned and developed within Chhatrapati Shahu Ji Maharaj University, Kanpur/i)
    ).toBeInTheDocument();

    // Compact Understated Institutional Attribution
    const vyasaAttr = screen.getByTestId('vyasa-attribution');
    expect(vyasaAttr).toBeInTheDocument();
    expect(vyasaAttr).toHaveTextContent(/VYASA — Design & Development/i);
    expect(vyasaAttr).toHaveTextContent('Harshit Gupta');
    expect(vyasaAttr).toHaveTextContent('M.Sc. Mathematics with AI & Data Science');
    expect(vyasaAttr).toHaveTextContent(/Chhatrapati Shahu Ji Maharaj University, Kanpur/i);
    expect(vyasaAttr).not.toHaveTextContent('Manali Yadav');
  });

  it('13. One Step Toward Institutional Innovation section renders evolution philosophy', () => {
    renderLandingPage();

    expect(
      screen.getByRole('heading', { name: 'One Step Toward Institutional Innovation' })
    ).toBeInTheDocument();

    expect(screen.getByText(/VYASA is not presented as a finished destination/i)).toBeInTheDocument();
  });

  it('14. The Vision Continues minimal closing section renders equation and pledge', () => {
    renderLandingPage();

    expect(screen.getByText('The Vision Continues')).toBeInTheDocument();
    expect(screen.getByText('Recognition')).toBeInTheDocument();
    expect(screen.getByText('Responsiveness')).toBeInTheDocument();
  });

  it('15. Institutional Access Gateways allow Scholar and Authority access', () => {
    renderLandingPage();

    expect(screen.getByText('Institutional Access Gateways')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Applicant Login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register as Applicant/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Authority Login/i })).toBeInTheDocument();

    // Test navigation
    fireEvent.click(screen.getByRole('button', { name: /Applicant Login/i }));
    expect(screen.getByTestId('applicant-login-dest')).toBeInTheDocument();
  });

  it('16. NIVARAN credit indicator renders and opens popover on desktop hover', () => {
    renderLandingPage();

    const creditBtn = screen.getByRole('button', { name: /NIVARAN-AI Design & Development Information/i });
    expect(creditBtn).toBeInTheDocument();
    expect(screen.queryByTestId('nivaran-credit-popover')).toBeNull();

    // Hover over container
    const container = creditBtn.closest('.vyasa-nivaran-credit-container')!;
    expect(container).toBeInTheDocument();
    fireEvent.mouseEnter(container);

    const popover = screen.getByTestId('nivaran-credit-popover');
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveTextContent('NIVARAN-AI');
    expect(popover).toHaveTextContent(/Design & Development/i);
  });

  it('17. NIVARAN credit correctly maps both Harshit Gupta and Manali Yadav without sole ownership', () => {
    renderLandingPage();

    const creditBtn = screen.getByRole('button', { name: /NIVARAN-AI Design & Development Information/i });
    fireEvent.click(creditBtn);

    const popover = screen.getByTestId('nivaran-credit-popover');
    expect(popover).toBeInTheDocument();

    // Must show both contributors
    expect(popover).toHaveTextContent('Harshit Gupta');
    expect(popover).toHaveTextContent('Manali Yadav');
    expect(popover).toHaveTextContent('M.Sc. Mathematics with AI & Data Science');
    expect(popover).toHaveTextContent(/Chhatrapati Shahu Ji Maharaj University, Kanpur/i);
  });

  it('18. Keyboard interaction on NIVARAN credit button works (Enter to toggle, Escape to close)', () => {
    renderLandingPage();

    const creditBtn = screen.getByRole('button', { name: /NIVARAN-AI Design & Development Information/i });

    // Press Enter to open
    fireEvent.keyDown(creditBtn, { key: 'Enter' });
    expect(screen.getByTestId('nivaran-credit-popover')).toBeInTheDocument();

    // Press Escape to close
    fireEvent.keyDown(creditBtn, { key: 'Escape' });
    expect(screen.queryByTestId('nivaran-credit-popover')).toBeNull();
  });

  it('19. Mobile/touch interaction: tap opens credit popover, outside click closes it', () => {
    renderLandingPage();

    const creditBtn = screen.getByRole('button', { name: /NIVARAN-AI Design & Development Information/i });

    // Tap to open
    fireEvent.click(creditBtn);
    expect(screen.getByTestId('nivaran-credit-popover')).toBeInTheDocument();

    // Outside click closes
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('nivaran-credit-popover')).toBeNull();
  });
});
