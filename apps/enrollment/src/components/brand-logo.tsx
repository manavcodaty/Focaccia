import { focacciaBrandMark, focacciaWordmark } from '@face-pass/shared';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { palette, typography } from '../theme';

export function BrandLogo() {
  return (
    <View
      accessibilityLabel={focacciaWordmark}
      accessibilityRole="image"
      accessible
      style={styles.logo}
    >
      <Svg height={36} viewBox={focacciaBrandMark.viewBox} width={36}>
        <Rect
          fill={palette.canvas}
          height={focacciaBrandMark.outerRect.height}
          rx={focacciaBrandMark.outerRect.rx}
          width={focacciaBrandMark.outerRect.width}
          x={focacciaBrandMark.outerRect.x}
          y={focacciaBrandMark.outerRect.y}
        />
        <Rect
          fill={palette.canvas}
          height={focacciaBrandMark.innerRect.height}
          rx={focacciaBrandMark.innerRect.rx}
          stroke={palette.hintOfGrey}
          strokeWidth={4}
          width={focacciaBrandMark.innerRect.width}
          x={focacciaBrandMark.innerRect.x}
          y={focacciaBrandMark.innerRect.y}
        />
        <Path d={focacciaBrandMark.shieldPath} fill={palette.ink} />
        <Path
          d={focacciaBrandMark.checkPath}
          fill="none"
          stroke={palette.canvas}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={8}
        />
      </Svg>
      <Text style={styles.wordmark}>{focacciaWordmark}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  wordmark: {
    ...typography.display,
    color: palette.ink,
    fontSize: 28,
    letterSpacing: -0.6,
    lineHeight: 30,
  },
});
