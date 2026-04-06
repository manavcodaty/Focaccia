export const palette = {
  accent: '#0066FF',
  accentSoft: '#E5F0FF',
  background: '#F7F9FC',
  card: '#FFFFFF',
  danger: '#B74B33',
  frame: 'rgba(248,250,255,0.5)',
  frameReady: 'rgba(216,243,232,0.45)',
  frameSoft: 'rgba(248,250,255,0.18)',
  ink: '#0A1024',
  line: '#D8E0F0',
  muted: '#64748B',
  overlay: 'rgba(10,16,36,0.26)',
  successBorder: '#A7DCC6',
  success: '#17775A',
  successSoft: '#D8F3E8',
  surfaceInverse: '#0A1024',
  surfaceInverseSoft: 'rgba(10,16,36,0.82)',
  textInverse: '#F8FAFF',
  textInverseMuted: 'rgba(248,250,255,0.8)',
  textInverseSubtle: 'rgba(248,250,255,0.78)',
  warning: '#8A5B14',
  warningBorder: '#E5C88A',
  warningSoft: '#F5E6CB',
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
  },
  bodyMedium: {
    fontFamily: fontFamilies.medium,
  },
  bodyStrong: {
    fontFamily: fontFamilies.semibold,
  },
  display: {
    fontFamily: fontFamilies.bold,
  },
  title: {
    fontFamily: fontFamilies.bold,
  },
} as const;

const enrollmentTheme = {
  fontFamilies,
  palette,
  typography,
} as const;

export default enrollmentTheme;
