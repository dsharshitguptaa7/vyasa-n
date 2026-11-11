import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SignaturePillarsSection } from '../components/SignaturePillarsSection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('VYASA Landing Page — Three Operational Pillars Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSection = () => {
    return render(
      <MemoryRouter>
        <SignaturePillarsSection />
      </MemoryRouter>
    );
  };

  it('1. Section header displays Three Operational Pillars title and eyebrow', () => {
    renderSection();

    const section = document.getElementById('operational-pillars');
    expect(section).toBeInTheDocument();

    // Eyebrow
    expect(section).toHaveTextContent('Operational Services');
    expect(section).toHaveTextContent('Core Governance Pillars');

    // Title & description
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Three Operational Pillars. One Unified Ecosystem.',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Direct institutional gateways to the university's active research recognition, grievance redressal, and research administration platforms\./i
      )
    ).toBeInTheDocument();
  });

  it('2. Pillar 1 (SAMA VEDA — SAMIKSHA) renders complete institutional metadata and tags', () => {
    renderSection();

    const samikshaCard = screen.getByTestId('service-card-samiksha');
    expect(samikshaCard).toBeInTheDocument();
    expect(samikshaCard).toHaveClass('vyasa-pillar-card--samiksha');

    // Domain & category
    expect(within(samikshaCard).getByText('SAMA VEDA')).toBeInTheDocument();
    expect(within(samikshaCard).getByText('Operational Pillar')).toBeInTheDocument();

    // Brand & pillar line
    expect(within(samikshaCard).getByRole('heading', { level: 3, name: /SAMIKSHA/i })).toBeInTheDocument();
    expect(within(samikshaCard).getByText(/Pillar • Research Recognition & Communication/i)).toBeInTheDocument();

    // Description
    expect(
      within(samikshaCard).getByText(
        /Explore the university's research recognition and communication ecosystem, including research publications, bulletins, academic achievements, and related research initiatives\./i
      )
    ).toBeInTheDocument();

    // 4 feature chips
    expect(within(samikshaCard).getByText('Publications Repository')).toBeInTheDocument();
    expect(within(samikshaCard).getByText('Research Bulletins')).toBeInTheDocument();
    expect(within(samikshaCard).getByText('Faculty Directory')).toBeInTheDocument();
    expect(within(samikshaCard).getByText('Certificate Verification')).toBeInTheDocument();

    // Primary CTA and secondary link
    const cta = within(samikshaCard).getByRole('button', { name: 'Explore SAMIKSHA' });
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith('/modules/sama-veda');

    const secondaryLink = within(samikshaCard).getByText('Portal: SAMIKSHA');
    fireEvent.click(secondaryLink);
    expect(mockNavigate).toHaveBeenCalledWith('/modules/sama-veda');
  });

  it('3. Pillar 2 (ATHARVA VEDA — NIVARAN) renders complete institutional metadata and tags', () => {
    renderSection();

    const nivaranCard = screen.getByTestId('service-card-nivaran');
    expect(nivaranCard).toBeInTheDocument();
    expect(nivaranCard).toHaveClass('vyasa-pillar-card--nivaran');

    // Domain & category
    expect(within(nivaranCard).getByText('ATHARVA VEDA')).toBeInTheDocument();
    expect(within(nivaranCard).getByText('Operational Pillar')).toBeInTheDocument();

    // Brand & pillar line
    expect(within(nivaranCard).getByRole('heading', { level: 3, name: /NIVARAN/i })).toBeInTheDocument();
    expect(within(nivaranCard).getByText(/Pillar • Grievance Redressal & Institutional Well-Being/i)).toBeInTheDocument();

    // Description
    expect(
      within(nivaranCard).getByText(
        /Access the university's grievance redressal service to submit concerns, track case progress, and follow the institutional resolution process\./i
      )
    ).toBeInTheDocument();

    // 4 feature chips
    expect(within(nivaranCard).getByText('Grievance Submission')).toBeInTheDocument();
    expect(within(nivaranCard).getByText('Multi-Tier Review')).toBeInTheDocument();
    expect(within(nivaranCard).getByText('Status Tracking')).toBeInTheDocument();
    expect(within(nivaranCard).getByText('Transparent Resolution')).toBeInTheDocument();

    // Primary CTA and secondary link
    const cta = within(nivaranCard).getByRole('button', { name: 'Explore NIVARAN' });
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith('/modules/atharva-veda/nivaran');

    const secondaryLink = within(nivaranCard).getByText('Portal: NIVARAN');
    fireEvent.click(secondaryLink);
    expect(mockNavigate).toHaveBeenCalledWith('/modules/atharva-veda/nivaran');
  });

  it('4. Pillar 3 (YAJUR VEDA — ANUDAAN) renders complete institutional metadata and tags', () => {
    renderSection();

    const anudaanCard = screen.getByTestId('service-card-anudaan');
    expect(anudaanCard).toBeInTheDocument();
    expect(anudaanCard).toHaveClass('vyasa-pillar-card--anudaan');

    // Domain & category
    expect(within(anudaanCard).getByText('YAJUR VEDA')).toBeInTheDocument();
    expect(within(anudaanCard).getByText('Operational Domain')).toBeInTheDocument();

    // Brand & domain line
    expect(within(anudaanCard).getByRole('heading', { level: 3, name: /ANUDAAN/i })).toBeInTheDocument();
    expect(within(anudaanCard).getByText(/Domain • Research Administration & Incentives/i)).toBeInTheDocument();

    // Description
    expect(
      within(anudaanCard).getByText(
        /An institutional initiative for eligible CSJMU Campus Faculty, Registered Research Scholars and Post-Doctoral Researchers to submit research publication incentive claims\./i
      )
    ).toBeInTheDocument();

    // 4 feature chips
    expect(within(anudaanCard).getByText('Publication Claims')).toBeInTheDocument();
    expect(within(anudaanCard).getByText('Author Attribution')).toBeInTheDocument();
    expect(within(anudaanCard).getByText('Bank Verification')).toBeInTheDocument();
    expect(within(anudaanCard).getByText('Incentive Disbursement')).toBeInTheDocument();

    // Primary CTA and secondary link
    const cta = within(anudaanCard).getByRole('button', { name: 'Explore ANUDAAN' });
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');

    const secondaryLink = within(anudaanCard).getByText('Portal: ANUDAAN');
    fireEvent.click(secondaryLink);
    expect(mockNavigate).toHaveBeenCalledWith('/modules/yajur-veda/anudaan');
  });
});
