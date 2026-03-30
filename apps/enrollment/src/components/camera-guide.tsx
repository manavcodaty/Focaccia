import { StyleSheet, View } from 'react-native';

import { palette } from '../theme';

export function CameraGuide({ ready }: { ready: boolean }) {
  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={[styles.outerFrame, ready ? styles.outerFrameReady : null]}>
        <View style={[styles.innerFrame, ready ? styles.innerFrameReady : null]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    bottom: 160,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 120,
  },
  innerFrame: {
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 32,
    borderWidth: 2,
    flex: 1,
  },
  innerFrameReady: {
    borderColor: palette.successSoft,
  },
  outerFrame: {
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 44,
    borderWidth: 1,
    padding: 12,
    width: '78%',
    aspectRatio: 0.76,
  },
  outerFrameReady: {
    borderColor: 'rgba(217,242,231,0.4)',
  },
});
