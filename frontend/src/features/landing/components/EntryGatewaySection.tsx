import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppIcon, SectionHeading } from '@vyasa/ui';

export const EntryGatewaySection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section id="entry-gateways" className="vyasa-story-section vyasa-gateways-section">
      {/* Decorative Architectural Watermark in Section Header */}
      <div className="vyasa-gateways-header-watermark" aria-hidden="true">
        <svg viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="vyasa-gateways-dome-svg">
          <path d="M200 20 C235 20 265 48 275 88 L125 88 C135 48 165 20 200 20 Z" stroke="rgba(212, 160, 23, 0.25)" strokeWidth="1.5" fill="rgba(212, 160, 23, 0.03)" />
          <path d="M200 6 L200 20" stroke="rgba(212, 160, 23, 0.4)" strokeWidth="2" />
          <circle cx="200" cy="5" r="3" fill="rgba(212, 160, 23, 0.4)" />
          <rect x="135" y="88" width="130" height="24" stroke="rgba(15, 43, 72, 0.08)" strokeWidth="1" />
          <line x1="150" y1="88" x2="150" y2="112" stroke="rgba(15, 43, 72, 0.1)" strokeWidth="1" />
          <line x1="170" y1="88" x2="170" y2="112" stroke="rgba(15, 43, 72, 0.1)" strokeWidth="1" />
          <line x1="190" y1="88" x2="190" y2="112" stroke="rgba(15, 43, 72, 0.1)" strokeWidth="1" />
          <line x1="210" y1="88" x2="210" y2="112" stroke="rgba(15, 43, 72, 0.1)" strokeWidth="1" />
          <line x1="230" y1="88" x2="230" y2="112" stroke="rgba(15, 43, 72, 0.1)" strokeWidth="1" />
          <line x1="250" y1="88" x2="250" y2="112" stroke="rgba(15, 43, 72, 0.1)" strokeWidth="1" />
          <rect x="80" y="112" width="240" height="60" stroke="rgba(15, 43, 72, 0.06)" strokeWidth="1" />
          <circle cx="200" cy="120" r="140" stroke="rgba(212, 160, 23, 0.1)" strokeWidth="1" strokeDasharray="4 4" />
        </svg>
      </div>

      {/* Unified Institutional Section Heading */}
      <SectionHeading
        align="center"
        eyebrow="UNIFIED AUTHENTICATION"
        title="Institutional Access Gateways"
        description="Select your institutional role to access affiliated research, scholar services, and administrative portals across VYASAᴺ."
      />

      <div className="vyasa-story-divider" aria-hidden="true" />

      {/* Visual Trust Indicators */}
      <div className="vyasa-gateways-trust-row" aria-label="Security and institutional trust indicators">
          <div className="vyasa-gateways-trust-item">
            <span className="vyasa-gateways-trust-icon" aria-hidden="true">
              <AppIcon name="shield" size={18} />
            </span>
            <div className="vyasa-gateways-trust-text">
              <span className="vyasa-gateways-trust-label">Secure Access</span>
              <span className="vyasa-gateways-trust-sub">Role-based authentication</span>
            </div>
          </div>

          <div className="vyasa-gateways-trust-item">
            <span className="vyasa-gateways-trust-icon" aria-hidden="true">
              <AppIcon name="layers" size={18} />
            </span>
            <div className="vyasa-gateways-trust-text">
              <span className="vyasa-gateways-trust-label">Integrated Ecosystem</span>
              <span className="vyasa-gateways-trust-sub">One portal, multiple services</span>
            </div>
          </div>

          <div className="vyasa-gateways-trust-item">
            <span className="vyasa-gateways-trust-icon" aria-hidden="true">
              <AppIcon name="book-open" size={18} />
            </span>
            <div className="vyasa-gateways-trust-text">
              <span className="vyasa-gateways-trust-label">University Verified</span>
              <span className="vyasa-gateways-trust-sub">Official institutional access</span>
            </div>
          </div>
        </div>

      {/* 3 Gateway Cards Grid */}
      <div className="vyasa-gateways-grid">
        {/* CARD A: Doctoral Scholars & Applicants */}
        <div className="vyasa-gateway-card vyasa-gateway-card--applicant">
          {/* Subtle Watermark in Card Background */}
          <div className="vyasa-gateway-card__watermark" aria-hidden="true">
            <svg viewBox="0 0 160 160" fill="currentColor">
              <path d="M80 20 L150 55 L80 90 L10 55 Z M80 102 L135 74 L135 110 C135 125 110 138 80 138 C50 138 25 125 25 110 L25 74 Z" opacity="0.04" />
            </svg>
          </div>

          <div>
            <div className="vyasa-gateway-card__top">
              <div className="vyasa-gateway-card__icon-box vyasa-gateway-card__icon-box--applicant" aria-hidden="true">
                <AppIcon name="users" size={24} color="#b2811a" />
              </div>
              <span className="vyasa-gateway-badge vyasa-gateway-badge--applicant">Applicant</span>
            </div>

            <h3 className="vyasa-gateway-card__title">Doctoral Scholars &amp; Applicants</h3>
            <p className="vyasa-gateway-card__subtitle">Scholar Services &amp; NIVARAN Grievance Resolution</p>

            <ul className="vyasa-gateway-features" aria-label="Applicant features">
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--applicant" aria-hidden="true">
                  <AppIcon name="graduation-cap" size={16} />
                </span>
                <span>Manage your doctoral academic profile</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--applicant" aria-hidden="true">
                  <AppIcon name="file-text" size={16} />
                </span>
                <span>Access research credentials and services</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--applicant" aria-hidden="true">
                  <AppIcon name="clock" size={16} />
                </span>
                <span>Track application progress and status</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--applicant" aria-hidden="true">
                  <AppIcon name="shield" size={16} />
                </span>
                <span>Submit and track grievances via NIVARAN</span>
              </li>
            </ul>
          </div>

          <div className="vyasa-gateway-card__actions">
            <button
              type="button"
              className="vyasa-gateway-btn vyasa-gateway-btn--primary"
              onClick={() => navigate('/applicant/login')}
            >
              <span>Applicant Login</span>
              <AppIcon name="arrow-right" size={16} />
            </button>

            <button
              type="button"
              className="vyasa-gateway-btn vyasa-gateway-btn--register"
              onClick={() => navigate('/applicant/register')}
            >
              <AppIcon name="user" size={16} />
              <span>Register as Applicant</span>
            </button>
          </div>
        </div>

        {/* CARD B: Institutional Authorities */}
        <div className="vyasa-gateway-card vyasa-gateway-card--authority">
          {/* Subtle Watermark in Card Background */}
          <div className="vyasa-gateway-card__watermark" aria-hidden="true">
            <svg viewBox="0 0 160 160" fill="currentColor">
              <path d="M80 15 L145 45 L15 45 Z M25 55 L45 55 L45 125 L25 125 Z M55 55 L75 55 L75 125 L55 125 Z M85 55 L105 55 L105 125 L85 125 Z M115 55 L135 55 L135 125 L115 125 Z M15 130 L145 130 L145 145 L15 145 Z" opacity="0.04" />
            </svg>
          </div>

          <div>
            <div className="vyasa-gateway-card__top">
              <div className="vyasa-gateway-card__icon-box vyasa-gateway-card__icon-box--authority" aria-hidden="true">
                <AppIcon name="building" size={24} color="#2563eb" />
              </div>
              <span className="vyasa-gateway-badge vyasa-gateway-badge--authority">Authority</span>
            </div>

            <h3 className="vyasa-gateway-card__title">Institutional Authorities</h3>
            <p className="vyasa-gateway-card__subtitle">Administrative Review &amp; Authority Portal</p>

            <ul className="vyasa-gateway-features" aria-label="Authority features">
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--authority" aria-hidden="true">
                  <AppIcon name="users" size={16} />
                </span>
                <span>Review student grievances and compliance</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--authority" aria-hidden="true">
                  <AppIcon name="file-text" size={16} />
                </span>
                <span>Administrative tools for deans and officers</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--authority" aria-hidden="true">
                  <AppIcon name="settings" size={16} />
                </span>
                <span>Manage university workflow and resolution steps</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--authority" aria-hidden="true">
                  <AppIcon name="bar-chart" size={16} />
                </span>
                <span>Access university reports and analytics</span>
              </li>
            </ul>
          </div>

          <div className="vyasa-gateway-card__actions">
            <button
              type="button"
              className="vyasa-gateway-btn vyasa-gateway-btn--primary"
              onClick={() => navigate('/authority/login')}
            >
              <span>Authority Login</span>
              <AppIcon name="arrow-right" size={16} />
            </button>

            <div className="vyasa-gateway-callout vyasa-gateway-callout--authority">
              <AppIcon name="info" size={16} color="#2563eb" className="vyasa-gateway-callout-icon" />
              <span>Authority accounts are created directly by University Administration. Public registration is not permitted.</span>
            </div>
          </div>
        </div>

        {/* CARD C: Public VYASA AI Assistant */}
        <div className="vyasa-gateway-card vyasa-gateway-card--assistant">
          {/* Subtle Watermark in Card Background */}
          <div className="vyasa-gateway-card__watermark" aria-hidden="true">
            <svg viewBox="0 0 160 160" fill="currentColor">
              <path d="M80 30 C105 30 130 20 150 15 L150 120 C130 125 105 135 80 140 C55 135 30 125 10 120 L10 15 C30 20 55 30 80 30 Z" opacity="0.04" />
            </svg>
          </div>

          <div>
            <div className="vyasa-gateway-card__top">
              <div className="vyasa-gateway-card__icon-box vyasa-gateway-card__icon-box--assistant" aria-hidden="true">
                <AppIcon name="layers" size={24} color="#0d766e" />
              </div>
              <span className="vyasa-gateway-badge vyasa-gateway-badge--assistant">Public &bull; No Login</span>
            </div>

            <h3 className="vyasa-gateway-card__title">VYASA AI Assistant</h3>
            <p className="vyasa-gateway-card__subtitle">Research &amp; Development Assistant &bull; CSJMU, Kanpur</p>

            <ul className="vyasa-gateway-features" aria-label="AI Assistant features">
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--assistant" aria-hidden="true">
                  <AppIcon name="book-open" size={16} />
                </span>
                <span>Get guidance on research and doctoral studies</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--assistant" aria-hidden="true">
                  <AppIcon name="settings" size={16} />
                </span>
                <span>Explore academic regulations and guidelines</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--assistant" aria-hidden="true">
                  <AppIcon name="file-text" size={16} />
                </span>
                <span>Course work credits and ordinance provisions</span>
              </li>
              <li className="vyasa-gateway-feature-item">
                <span className="vyasa-gateway-feature-icon vyasa-gateway-feature-icon--assistant" aria-hidden="true">
                  <AppIcon name="info" size={16} />
                </span>
                <span>Source-grounded answers from official documents</span>
              </li>
            </ul>
          </div>

          <div className="vyasa-gateway-card__actions">
            <button
              type="button"
              className="vyasa-gateway-btn vyasa-gateway-btn--primary"
              onClick={() => navigate('/phd-admission')}
            >
              <span>Open VYASA AI Assistant</span>
              <AppIcon name="arrow-right" size={16} />
            </button>

            <div className="vyasa-gateway-callout vyasa-gateway-callout--assistant">
              <AppIcon name="globe" size={16} color="#0d766e" className="vyasa-gateway-callout-icon" />
              <span>Accessible publicly without login or user registration. Sourced directly from official university documents.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EntryGatewaySection;


