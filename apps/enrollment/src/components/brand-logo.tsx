import { focacciaBrand, focacciaBrandMark, focacciaWordmark } from '@face-pass/shared';
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
          fill={focacciaBrand.background}
          height={focacciaBrandMark.outerRect.height}
          rx={focacciaBrandMark.outerRect.rx}
          width={focacciaBrandMark.outerRect.width}
          x={focacciaBrandMark.outerRect.x}
          y={focacciaBrandMark.outerRect.y}
        />
        <Rect
          fill={focacciaBrand.card}
          height={focacciaBrandMark.innerRect.height}
          rx={focacciaBrandMark.innerRect.rx}
          stroke={focacciaBrand.border}
          strokeWidth={4}
          width={focacciaBrandMark.innerRect.width}
          x={focacciaBrandMark.innerRect.x}
          y={focacciaBrandMark.innerRect.y}
        />
        <Path d={focacciaBrandMark.shieldPath} fill={focacciaBrand.primary} />
        <Path
          d={focacciaBrandMark.checkPath}
          fill="none"
          stroke={focacciaBrand.primaryForeground}
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
    fontStyle: 'italic',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
});
