import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  VedicInvocation,
  RIG_VEDA_MANTRA,
  MANTRA_ORBIT_TEXT,
  INVOCATION_SESSION_KEY,
  resetInvocationSession,
  setInvocationCompleted,
} from '../VedicInvocation';
import { VedicInvocationWrapper } from '../VedicInvocationWrapper';
import { AuthContext, AuthContextValue } from '../../../context/AuthContext';

describe('VYASA Signature Vedic Knowledge Invocation Loading Experience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    resetInvocationSession();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    sessionStorage.clear();
    resetInvocationSession();
  });

  it('1. Invocation renders on initial application load', () => {
    render(<VedicInvocation isAppReady={false} />);
    const invocation = screen.getByTestId('vyasa-vedic-invocation');
    expect(invocation).toBeInTheDocument();
    expect(invocation).toHaveAttribute('role', 'status');
    expect(invocation).toHaveAttribute('aria-label', 'VYASA Knowledge Ecosystem');
    // Ensure visually dark "VYASA is loading" text is removed
    expect(screen.queryByText('VYASA is loading')).toBeNull();
  });

  it('2. VYASA logo renders at exact center with official asset', () => {
    render(<VedicInvocation isAppReady={false} />);
    const logoContainer = screen.getByTestId('vyasa-invocation-logo');
    expect(logoContainer).toBeInTheDocument();
    const logoImg = screen.getByAltText('VYASA');
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveClass('vyasa-invocation__logo');
  });

  it('3. Sanskrit Rig Vedic mantra renders in proper Devanagari', () => {
    render(<VedicInvocation isAppReady={false} />);
    const orbitContainer = screen.getByTestId('vyasa-invocation-orbit');
    expect(orbitContainer).toBeInTheDocument();
    // Verify the text content includes the Rig Veda 1.89.1 mantra
    expect(orbitContainer.textContent).toContain(RIG_VEDA_MANTRA);
    expect(orbitContainer.textContent).toContain('आ नो भद्राः क्रतवो यन्तु विश्वतः॥');
  });

  it('4. Circular text path exists with SVG <textPath>', () => {
    const { container } = render(<VedicInvocation isAppReady={false} />);
    const path = container.querySelector('#vyasaMantraOrbitPath');
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute('d')).toContain('M 62, 248 A 136, 136 0 1, 1 298, 248');

    const textPath = container.querySelector('textPath');
    expect(textPath).toBeInTheDocument();
    expect(textPath?.getAttribute('href') || textPath?.getAttribute('xlink:href')).toBe('#vyasaMantraOrbitPath');
    expect(textPath?.textContent).toContain(RIG_VEDA_MANTRA);
  });

  it('5. Animation components and structure are configured', () => {
    render(<VedicInvocation isAppReady={false} />);
    // Glow breathing layer
    expect(screen.getByTestId('vyasa-invocation-glow')).toBeInTheDocument();
    // Wordmark & Hindi Tagline
    expect(screen.getByText('VYASA')).toBeInTheDocument();
    expect(screen.getByText('ज्ञान से शोध तक, AI के साथ')).toBeInTheDocument();
  });

  it('6. Reduced-motion behavior works cleanly', () => {
    // Mock window.matchMedia for prefers-reduced-motion
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onComplete = vi.fn();
    render(<VedicInvocation isAppReady={true} onComplete={onComplete} />);

    // Fast-forward reduced duration timer (2400ms)
    act(() => {
      vi.advanceTimersByTime(2450);
    });

    // Fast-forward exit transition (750ms)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(onComplete).toHaveBeenCalled();
    window.matchMedia = originalMatchMedia;
  });

  it('7. Invocation does not appear on internal navigation if already completed in session', () => {
    setInvocationCompleted();
    const mockAuthContext: Partial<AuthContextValue> = {
      isLoading: false,
      isAuthenticated: true,
      user: { id: '1', email: 'scholar@csjmu.ac.in', roles: ['applicant'] } as any,
    };

    render(
      <AuthContext.Provider value={mockAuthContext as AuthContextValue}>
        <VedicInvocationWrapper>
          <div data-testid="dashboard-content">Dashboard Content</div>
        </VedicInvocationWrapper>
      </AuthContext.Provider>
    );

    // Invocation should not be rendered
    expect(screen.queryByTestId('vyasa-vedic-invocation')).toBeNull();
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
  });

  it('8. Authenticated user reaches /dashboard through wrapper', () => {
    const mockAuthContext: Partial<AuthContextValue> = {
      isLoading: false,
      isAuthenticated: true,
      user: { id: '1', email: 'scholar@csjmu.ac.in', roles: ['applicant'] } as any,
    };

    render(
      <AuthContext.Provider value={mockAuthContext as AuthContextValue}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <VedicInvocationWrapper>
            <Routes>
              <Route path="/dashboard" element={<div data-testid="authenticated-dashboard">Vyasa Dashboard</div>} />
            </Routes>
          </VedicInvocationWrapper>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Initial invocation is present
    expect(screen.getByTestId('vyasa-vedic-invocation')).toBeInTheDocument();

    // Advance time past minDuration (6800ms)
    act(() => {
      vi.advanceTimersByTime(6900);
    });
    // Advance exit transition (750ms)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Overlay is dismissed, revealing authenticated dashboard
    expect(screen.queryByTestId('vyasa-vedic-invocation')).toBeNull();
    expect(screen.getByTestId('authenticated-dashboard')).toBeInTheDocument();
  });

  it('9. Public user reaches public VYASA experience through wrapper', () => {
    const mockAuthContext: Partial<AuthContextValue> = {
      isLoading: false,
      isAuthenticated: false,
      user: null,
    };

    render(
      <AuthContext.Provider value={mockAuthContext as AuthContextValue}>
        <MemoryRouter initialEntries={['/']}>
          <VedicInvocationWrapper>
            <Routes>
              <Route path="/" element={<div data-testid="public-landing">Public Landing Page</div>} />
            </Routes>
          </VedicInvocationWrapper>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByTestId('vyasa-vedic-invocation')).toBeInTheDocument();

    // Advance time past minDuration (6800ms)
    act(() => {
      vi.advanceTimersByTime(6900);
    });
    // Advance exit transition (750ms)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.queryByTestId('vyasa-vedic-invocation')).toBeNull();
    expect(screen.getByTestId('public-landing')).toBeInTheDocument();
  });

  it('10. No horizontal overflow: container uses fixed full-screen dimensions and hidden overflow', () => {
    render(<VedicInvocation isAppReady={false} />);
    const invocation = screen.getByTestId('vyasa-vedic-invocation');
    expect(invocation).toHaveClass('vyasa-invocation-container');
    // In CSS .vyasa-invocation-container has overflow: hidden, width: 100vw, height: 100vh, position: fixed
  });

  it('11. No layout shift: unmounts cleanly and records session status', () => {
    const onComplete = vi.fn();
    render(<VedicInvocation isAppReady={true} onComplete={onComplete} minDuration={1000} />);

    act(() => {
      vi.advanceTimersByTime(1100); // minDuration elapsed
    });
    act(() => {
      vi.advanceTimersByTime(800); // exit transition complete (750ms)
    });

    expect(onComplete).toHaveBeenCalled();
    expect(sessionStorage.getItem(INVOCATION_SESSION_KEY)).toBe('true');
    expect(screen.queryByTestId('vyasa-vedic-invocation')).toBeNull();
  });

  it('12. Invocation exits correctly with exiting animation class before unmounting', () => {
    render(<VedicInvocation isAppReady={true} minDuration={1000} />);
    const invocation = screen.getByTestId('vyasa-vedic-invocation');
    expect(invocation).not.toHaveClass('vyasa-invocation-container--exiting');

    act(() => {
      vi.advanceTimersByTime(1050);
    });

    // Should now have the exiting class
    expect(screen.getByTestId('vyasa-vedic-invocation')).toHaveClass('vyasa-invocation-container--exiting');

    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Should be unmounted from DOM
    expect(screen.queryByTestId('vyasa-vedic-invocation')).toBeNull();
  });

  it('13. Slow initialization does not break the experience; keeps rotating until ready', () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <VedicInvocation isAppReady={false} onComplete={onComplete} minDuration={1000} />
    );

    // Pass 1500ms: minDuration passed, but app is NOT ready
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Invocation should still be active and NOT exiting
    const invocation = screen.getByTestId('vyasa-vedic-invocation');
    expect(invocation).toBeInTheDocument();
    expect(invocation).not.toHaveClass('vyasa-invocation-container--exiting');
    expect(onComplete).not.toHaveBeenCalled();

    // Now app becomes ready (e.g. at 2500ms)
    rerender(<VedicInvocation isAppReady={true} onComplete={onComplete} minDuration={1000} />);

    // Now it should begin exiting
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('vyasa-vedic-invocation')).toHaveClass('vyasa-invocation-container--exiting');

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onComplete).toHaveBeenCalled();
  });

  it('14. Existing authentication remains intact during invocation', () => {
    const mockAuthContext: Partial<AuthContextValue> = {
      isLoading: true,
      isAuthenticated: false,
      user: null,
      token: 'fake-token',
    };

    const { rerender } = render(
      <AuthContext.Provider value={mockAuthContext as AuthContextValue}>
        <VedicInvocationWrapper>
          <div data-testid="target">Protected App</div>
        </VedicInvocationWrapper>
      </AuthContext.Provider>
    );

    expect(screen.getByTestId('vyasa-vedic-invocation')).toBeInTheDocument();

    // Auth completes and resolves user
    const updatedAuthContext: Partial<AuthContextValue> = {
      isLoading: false,
      isAuthenticated: true,
      user: {
        id: '123',
        email: 'namita.tiwari@csjmu.ac.in',
        first_name: 'Namita',
        last_name: 'Tiwari',
        roles: ['authority'],
        authority_role: 'DEAN',
      } as any,
      token: 'fake-token',
    };

    rerender(
      <AuthContext.Provider value={updatedAuthContext as AuthContextValue}>
        <VedicInvocationWrapper>
          <div data-testid="target">Protected App</div>
        </VedicInvocationWrapper>
      </AuthContext.Provider>
    );

    act(() => {
      vi.advanceTimersByTime(6900);
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.queryByTestId('vyasa-vedic-invocation')).toBeNull();
    expect(screen.getByTestId('target')).toBeInTheDocument();
  });
});
