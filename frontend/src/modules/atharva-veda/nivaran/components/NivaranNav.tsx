import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';

export const NivaranNav: React.FC = () => {
  const {
    isApplicant,
    isManager,
    isAssistantDean,
    isAssociateDean,
    isDean,
    isAdmin,
  } = useAuth();

  const navItemStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 500,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    color: isActive ? 'var(--vyasa-primary, #0f2b48)' : 'var(--vyasa-text-secondary, #475569)',
    backgroundColor: isActive ? 'rgba(15, 43, 72, 0.05)' : 'transparent',
    borderBottom: isActive ? '2.5px solid var(--vyasa-gold, #b2811a)' : '2.5px solid transparent',
  });

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--vyasa-border, #e2e8f0)',
        marginBottom: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(15, 43, 72, 0.03)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '14px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: 'var(--vyasa-gold, #b2811a)',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
          }}
        >
          ATHARVA VEDA &bull; NIVARAN
        </span>
      </div>

      {/* Applicant-only capabilities */}
      {isApplicant && (
        <>
          <NavLink to="/modules/atharva-veda/nivaran/my-grievances" style={navItemStyle}>
            My Grievances
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/submit" style={navItemStyle}>
            Submit Grievance
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/e-files" style={navItemStyle}>
            My E-Files
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/student-records" style={navItemStyle}>
            Student Master Record
          </NavLink>
        </>
      )}

      {/* Authority role-scoped queues */}
      {isManager && (
        <>
          <NavLink to="/modules/atharva-veda/nivaran/manager/queue" style={navItemStyle}>
            Manager Triage Queue
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/manager/closure-queue" style={navItemStyle}>
            Final Closure Queue
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/e-files" style={navItemStyle}>
            E-Files
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/student-records" style={navItemStyle}>
            Student Records
          </NavLink>
        </>
      )}

      {isAssistantDean && (
        <>
          <NavLink to="/modules/atharva-veda/nivaran/assistant-dean/dashboard" style={navItemStyle}>
            Jurisdictional Docket
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/assistant-dean/cases" style={navItemStyle}>
            Assigned Cases
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/committees" style={navItemStyle}>
            Committees
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/e-files" style={navItemStyle}>
            E-Files
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/student-records" style={navItemStyle}>
            Student Records
          </NavLink>
        </>
      )}

      {isAssociateDean && (
        <>
          <NavLink to="/modules/atharva-veda/nivaran/associate-dean/dashboard" style={navItemStyle}>
            Executive Docket
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/associate-dean/cases" style={navItemStyle}>
            Cluster Cases
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/committees" style={navItemStyle}>
            Committees
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/e-files" style={navItemStyle}>
            E-Files
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/student-records" style={navItemStyle}>
            Student Records
          </NavLink>
        </>
      )}

      {isDean && (
        <>
          <NavLink to="/modules/atharva-veda/nivaran/dean/dashboard" style={navItemStyle}>
            Executive Command Center
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/dean/cases" style={navItemStyle}>
            Executive Queue
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/committees" style={navItemStyle}>
            Committees
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/e-files" style={navItemStyle}>
            E-Files
          </NavLink>
          <NavLink to="/modules/atharva-veda/nivaran/student-records" style={navItemStyle}>
            Student Records
          </NavLink>
        </>
      )}

      {/* Admin control-plane link */}
      {isAdmin && !isDean && !isAssociateDean && !isAssistantDean && !isManager && (
        <NavLink to="/admin/atharva/authorities" style={navItemStyle}>
          Admin Taxonomy &amp; Authorities &rarr;
        </NavLink>
      )}
    </nav>
  );
};
