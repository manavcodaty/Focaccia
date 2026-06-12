/**
 * Focaccia Enrollment App — Steep / Warm, Crisp Canvas Theme
 * Derived from docs/DESIGN.md
 */

export const palette = {
  // Core DESIGN.md tokens
  canvas: '#FFFFFF',
  ink: '#17191C',
  graphite: '#000000',
  warmMist: '#FBE1D1',
  terracotta: '#5D2A1A',
  fog: '#F7F7F8',
  mutedStone: '#4C4C4C',
  lightSteel: '#777B86',
  hintOfGrey: '#A3A6AF',
  duskLink: '#8B8C8D',

  // Semantic aliases
  background: '#FFFFFF',
  card: '#FFFFFF',
  accent: '#FBE1D1',
  accentStrong: '#5D2A1A',

  // Status
  success: '#2A7D5A',
  successSoft: '#E5F4EC',
  successBorder: '#A7DCC6',
  danger: '#B74B33',
  dangerSoft: '#FDE3DB',
  dangerBorder: '#E9B9AB',
  warning: '#8A5B14',
  warningSoft: '#F5E6CB',
  warningBorder: '#E5C88A',

  // Overlays & camera
  overlay: 'rgba(23, 25, 28, 0.24)',
  frame: 'rgba(255, 255, 255, 0.5)',
  frameReady: 'rgba(229, 244, 236, 0.45)',
  frameSoft: 'rgba(255, 255, 255, 0.18)',

  // Inverse (for dark surfaces like processing overlays)
  surfaceInverse: '#17191C',
  surfaceInverseSoft: 'rgba(23, 25, 28, 0.82)',
  textInverse: '#FFFFFF',
  textInverseMuted: 'rgba(255, 255, 255, 0.8)',
  textInverseSubtle: 'rgba(255, 255, 255, 0.78)',
} as const;

export const fontFamilies = {
  body: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

export const typography = {
  body: {
    fontFamily: fontFamilies.body,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontFamily: fontFamilies.medium,
    fontWeight: '500' as const,
  },
  bodyStrong: {
    fontFamily: fontFamilies.semibold,
    fontWeight: '600' as const,
  },
  display: {
    fontFamily: fontFamilies.bold,
    fontWeight: '700' as const,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontWeight: '600' as const,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  section: 40,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  card: 24,
  button: 9999,
} as const;

const enrollmentTheme = {
  fontFamilies,
  palette,
  radii,
  spacing,
  typography,
} as const;

export default enrollmentTheme;
