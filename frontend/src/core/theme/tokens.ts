export const colors = {
  primary: '#0E5A4A',
  primaryLight: '#E6F0EE',
  primaryDark: '#0A4538',
  gold: '#C7A24B',
  goldLight: '#FBF4E6',
  blue: '#2F6FB0',
  blueLight: '#E9F0F8',
  background: '#F6F8F6',
  surface: '#FFFFFF',
  border: '#ECEFEC',
  text: '#19211E',
  textMuted: '#6B746F',
  textDisabled: '#9AA39E',
  success: '#1B873F',
  successBg: '#E7F2EB',
  warning: '#D98A0B',
  warningBg: '#FBF0DC',
  danger: '#C8372E',
  dangerBg: '#FBE7E5',
  info: '#2F6FB0',
  infoBg: '#E9F0F8',
  darkBg: '#0E1A16',
  darkSurface: '#16241F',
  darkBorder: 'rgba(255,255,255,0.07)',
  darkText: '#EAF0ED',
  darkMuted: '#93A39C',
  white: '#FFFFFF',
} as const;

export const fontSize = {
  display: '28px',
  h1: '24px',
  h2: '22px',
  h3: '18px',
  bodyLg: '16px',
  body: '15px',
  bodySm: '14px',
  caption: '12px',
  micro: '11px',
} as const;

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  display: 1.3,
  heading: 1.35,
  body: 1.6,
  caption: 1.4,
  micro: 1.3,
} as const;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  pill: '50px',
  full: '9999px',
  phone: '44px',
  card: '24px',
  icon: '12px',
} as const;

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export const shadow = {
  xs: '0 1px 3px rgba(14,90,74,.06)',
  sm: '0 2px 8px rgba(14,90,74,.08)',
  md: '0 4px 16px rgba(14,90,74,.10)',
  lg: '0 8px 32px rgba(14,90,74,.12)',
  gold: '0 4px 20px rgba(199,162,75,.25)',
  blue: '0 0 22px 1px rgba(47,111,176,.28)',
  danger: '0 4px 16px rgba(200,55,46,.15)',
  logo: '0 8px 24px rgba(0,0,0,.18)',
} as const;

export const transition = {
  micro: '150ms ease-out',
  element: '200ms ease-out',
  component: '250ms ease-in-out',
  screen: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const layout = {
  screenPaddingH: '20px',
  bottomNavHeight: '72px',
  cardGap: '12px',
  sectionGap: '24px',
  contentPaddingBottom: '88px',
} as const;

export const fonts = {
  arabic: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif",
  icons: "'Material Symbols Rounded'",
} as const;

export const splash = {
  durationMs: 2500,
  progressDurationMs: 2000,
  logoSize: '88px',
  accentWidth: '56px',
  accentHeight: '3px',
  progressHeight: '3px',
} as const;
