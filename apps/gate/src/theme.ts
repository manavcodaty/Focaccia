/** Shared warm-civic tokens tuned for fast gate operations. */
export const palette = {
  canvas: '#FFFDFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F7F4F1',
  surfaceClay: '#F4DED2',
  ink: '#1D1917',
  mutedStone: '#625B56',
  lightSteel: '#817973',
  hintOfGrey: '#817973',
  border: '#DED8D3',
  borderStrong: '#BDB4AD',
  clay: '#7B3F2C',
  clayPressed: '#673323',
  warmMist: '#F4DED2',

  // Compatibility aliases used by existing route controllers and styles.
  graphite: '#1D1917',
  terracotta: '#7B3F2C',
  fog: '#F7F4F1',
  duskLink: '#6C4B3F',
  background: '#FFFDFC',
  card: '#FFFFFF',
  accent: '#F4DED2',
  accentStrong: '#7B3F2C',

  accept: '#176747',
  acceptSoft: '#E7F4ED',
  acceptBorder: '#A7D6C0',
  alert: '#9D3525',
  alertSoft: '#FBE8E3',
  alertBorder: '#E4B3A8',
  warning: '#7A4D06',
  warningSoft: '#F8ECD4',
  warningBorder: '#DEC284',
  neutralSoft: '#F1EEEB',
  neutralBorder: '#D5CEC8',

  overlay: 'rgba(29, 25, 23, 0.3)',
  scanFrame: '#FFFDFC',
  panel: '#F7F4F1',
  surfaceInverse: '#1D1917',
  surfaceInverseSoft: 'rgba(29, 25, 23, 0.88)',
  textInverse: '#FFFDFC',
  textInverseMuted: '#D9D1CB',
} as const;

export const fontFamilies = {
  body: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

export const typography = {
  body: { fontFamily: fontFamilies.body, fontWeight: '400' as const },
  bodyMedium: { fontFamily: fontFamilies.medium, fontWeight: '500' as const },
  bodyStrong: { fontFamily: fontFamilies.semibold, fontWeight: '600' as const },
  display: { fontFamily: fontFamilies.bold, fontWeight: '700' as const },
  title: { fontFamily: fontFamilies.semibold, fontWeight: '600' as const },
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
  spacious: 48,
} as const;

export const radii = {
  sm: 8,
  control: 12,
  md: 12,
  field: 14,
  lg: 16,
  panel: 18,
  xl: 20,
  card: 20,
  button: 14,
  status: 999,
} as const;

const gateTheme = { fontFamilies, palette, radii, spacing, typography } as const;

export default gateTheme;
