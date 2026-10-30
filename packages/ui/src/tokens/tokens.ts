export const vyasaColors = {
  // 1. Deep Scholarly Blue (Primary)
  primary: '#0f2b48',
  primaryHover: '#091c30',
  primaryLight: '#1b4572',
  primarySurface: '#eff5fa',
  primaryBorder: '#cadbef',
  primaryContrast: '#ffffff',

  // 2. Refined Indian Saffron
  saffron: '#c85602',
  saffronHover: '#a54400',
  saffronLight: '#fef4eb',
  saffronBorder: '#fbd2ad',
  saffronContrast: '#ffffff',

  // 3. Academic Gold
  gold: '#b2811a',
  goldHover: '#8f650e',
  goldLight: '#fcf7eb',
  goldBorder: '#ecdfba',
  goldContrast: '#ffffff',

  // 4. Technology Teal
  teal: '#0d766e',
  tealHover: '#09524c',
  tealLight: '#f0fdfa',
  tealBorder: '#99f6e4',
  tealContrast: '#ffffff',

  // 5. Warm Ivory & Neutral Backgrounds
  ivory: '#faf7f2',
  ivoryDark: '#f2ede4',
  surface: '#ffffff',
  surfaceWarm: '#fdfbf7',
  surfaceMuted: '#f6f2ea',

  // 6. Soft Black & Content Colors
  text: '#19202a',
  textSecondary: '#4b5565',
  textMuted: '#6b7280',
  textInverse: '#ffffff',

  // Borders & Dividers
  border: '#e3dcd1',
  borderSubtle: '#ede7de',
  borderFocus: '#0f2b48',

  // Semantic Feedback
  success: '#15803d',
  successLight: '#f0fdf4',
  successBorder: '#bbf7d0',
  warning: '#b45309',
  warningLight: '#fffbeb',
  warningBorder: '#fde68a',
  danger: '#b91c1c',
  dangerLight: '#fef2f2',
  dangerBorder: '#fecaca',
  info: '#0d766e',
  infoLight: '#f0fdfa',
  infoBorder: '#99f6e4',
} as const;

export const vyasaTokens = {
  colors: vyasaColors,
  spacing: {
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
  },
  radii: {
    none: '0px',
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    pill: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(25, 32, 42, 0.04)',
    md: '0 4px 12px -2px rgba(25, 32, 42, 0.06), 0 2px 6px -1px rgba(25, 32, 42, 0.03)',
    lg: '0 12px 24px -4px rgba(25, 32, 42, 0.08), 0 4px 10px -2px rgba(25, 32, 42, 0.04)',
    modal: '0 20px 35px -5px rgba(15, 43, 72, 0.16), 0 10px 15px -3px rgba(15, 43, 72, 0.08)',
    dropdown: '0 6px 18px rgba(0, 0, 0, 0.08)',
  },
  transitions: {
    fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const vyasaBrand = {
  name: 'VYASAᴺ',
  ecosystemName: 'VYASAᴺ Research Ecosystem',
  assistantName: 'VYASA AI Assistant',
  taglineHindi: 'ज्ञान से शोध तक, AI के साथ',
  taglineEnglish: 'From Knowledge to Research, with AI',
} as const;
