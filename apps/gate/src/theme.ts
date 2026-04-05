export const palette = {
  accept: '#17775A',
  acceptBorder: '#A7DCC6',
  acceptSoft: '#D8F3E8',
  alert: '#B74B33',
  alertBorder: '#E9B9AB',
  alertSoft: '#FDE3DB',
  background: '#F7F9FC',
  card: '#FFFFFF',
  highlight: '#0066FF',
  highlightSoft: '#E5F0FF',
  ink: '#0A1024',
  line: '#D8E0F0',
  muted: '#64748B',
  overlay: 'rgba(10,16,36,0.18)',
  panel: '#EDF2FB',
  scanFrame: '#F8FAFF',
  surfaceInverseSoft: 'rgba(10,16,36,0.74)',
  textInverse: '#F8FAFF',
  warning: '#8A5B14',
  warningBorder: '#E5C88A',
  warningSoft: '#F5E6CB',
} as const;

const gateTheme = {
  palette,
} as const;

export default gateTheme;
