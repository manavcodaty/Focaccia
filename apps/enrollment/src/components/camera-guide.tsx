import { StyleSheet, View } from 'react-native';

import { scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette } from '../theme';

export function CameraGuide({ ready }: { ready: boolean }) {
  const layout = useResponsiveLayout();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          paddingHorizontal: scaleSpacing(layout, layout.isLandscape ? 24 : 18, 1.08),
          paddingVertical: scaleSpacing(layout, layout.isLandscape ? 24 : 18, 1.08),
        },
      ]}
    >
      <View
        style={[
          styles.outerFrame,
          {
            aspectRatio: layout.isLandscape ? 1.08 : 0.76,
            maxWidth: layout.isTablet ? 440 : 360,
            padding: scaleSpacing(layout, 12, 1.08),
            width: layout.isLandscape ? '72%' : '78%',
          },
          ready ? styles.outerFrameReady : null,
        ]}
      >
        <View style={[styles.innerFrame, ready ? styles.innerFrameReady : null]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  innerFrame: {
    borderColor: palette.frame,
    borderRadius: 32,
    borderWidth: 2,
    flex: 1,
  },
  innerFrameReady: {
    borderColor: palette.successSoft,
  },
  outerFrame: {
    borderColor: palette.frameSoft,
    borderRadius: 44,
    borderWidth: 1,
  },
  outerFrameReady: {
    borderColor: palette.frameReady,
  },
});
