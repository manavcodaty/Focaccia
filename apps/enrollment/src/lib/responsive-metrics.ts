export const TABLET_BREAKPOINT = 768;

export interface ResponsiveMetrics {
  cameraAspectRatio: number;
  cameraFrameMaxWidth: number;
  contentMaxWidth: number;
  horizontalPadding: number;
  isLandscape: boolean;
  isTablet: boolean;
  qrSize: number;
  sectionGap: number;
  shortSide: number;
  verticalPadding: number;
  wideContentMaxWidth: number;
  width: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getResponsiveMetrics({
  height,
  width,
}: {
  height: number;
  width: number;
}): ResponsiveMetrics {
  const shortSide = Math.min(width, height);
  const isLandscape = width > height;
  const isTablet = shortSide >= TABLET_BREAKPOINT || width >= 900;
  const horizontalPadding = Math.round(
    clamp(width * (isTablet ? 0.042 : 0.05), 16, isTablet ? 32 : 24),
  );

  return {
    cameraAspectRatio: isLandscape ? (isTablet ? 1.18 : 1.02) : 0.78,
    cameraFrameMaxWidth: isTablet ? (isLandscape ? 720 : 540) : isLandscape ? 420 : 460,
    contentMaxWidth: isTablet ? (isLandscape ? 620 : 640) : width,
    horizontalPadding,
    isLandscape,
    isTablet,
    qrSize: Math.round(
      clamp(shortSide * (isTablet ? 0.38 : 0.58), 208, isTablet ? 320 : 260),
    ),
    sectionGap: isTablet ? 20 : 18,
    shortSide,
    verticalPadding: isTablet ? 24 : 18,
    wideContentMaxWidth: isTablet ? (isLandscape ? 820 : 700) : width,
    width,
  };
}

export function scaleFont(
  metrics: Pick<ResponsiveMetrics, 'isLandscape' | 'isTablet'>,
  baseSize: number,
  tabletBoost = 1.08,
): number {
  if (!metrics.isTablet) {
    return baseSize;
  }

  const factor = metrics.isLandscape ? tabletBoost + 0.02 : tabletBoost;

  return Math.round(baseSize * factor);
}

export function scaleSpacing(
  metrics: Pick<ResponsiveMetrics, 'isLandscape' | 'isTablet'>,
  baseSize: number,
  tabletBoost = 1.1,
): number {
  if (!metrics.isTablet) {
    return baseSize;
  }

  const factor = metrics.isLandscape ? tabletBoost + 0.04 : tabletBoost;

  return Math.round(baseSize * factor);
}
