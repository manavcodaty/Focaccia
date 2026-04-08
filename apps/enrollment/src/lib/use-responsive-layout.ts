import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { getResponsiveMetrics } from './responsive-metrics';

export function useResponsiveLayout() {
  const { height, width } = useWindowDimensions();

  return useMemo(() => getResponsiveMetrics({ height, width }), [height, width]);
}
