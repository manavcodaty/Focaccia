/**
 * JS mirror of global.css for the few props that cannot take a className
 * (navigation chrome, QR, spinners, placeholders). Keep both files in sync.
 */
export const THEME = {
  light: {
    background: '#ffffff',
    foreground: '#0a0a0a',
    card: '#ffffff',
    popover: '#ffffff',
    primary: '#171717',
    primaryForeground: '#fafafa',
    secondary: '#f5f5f5',
    muted: '#f5f5f5',
    mutedForeground: '#696969',
    accent: '#f5f5f5',
    destructive: '#e7000b',
    success: '#14874e',
    warning: '#d67c00',
    border: '#e5e5e5',
    input: '#e5e5e5',
    ring: '#a1a1a1',
    radius: 10,
  },
  dark: {
    background: '#0a0a0a',
    foreground: '#fafafa',
    card: '#171717',
    popover: '#171717',
    primary: '#e5e5e5',
    primaryForeground: '#171717',
    secondary: '#262626',
    muted: '#262626',
    mutedForeground: '#a1a1a1',
    accent: '#262626',
    destructive: '#ff6467',
    success: '#4bc680',
    warning: '#f5ae39',
    border: '#262626',
    input: '#262626',
    ring: '#737373',
    radius: 10,
  },
} as const;

export const FONT = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

export const NAV_THEME = {
  light: {
    dark: false,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    dark: true,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
} as const;
