import { privatePassBrandMark, privatePassWordmark } from '@face-pass/shared';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { palette, typography } from '../theme';

export function BrandLogo() {
  return (
    <View
      accessibilityLabel={privatePassWordmark}
      accessibilityRole="image"
      accessible
      style={styles.logo}
    >
      <Svg height={36} viewBox={privatePassBrandMark.viewBox} width={36}>
        <Rect
          fill={palette.canvas}
          height={privatePassBrandMark.outerRect.height}
          rx={privatePassBrandMark.outerRect.rx}
          width={privatePassBrandMark.outerRect.width}
          x={privatePassBrandMark.outerRect.x}
          y={privatePassBrandMark.outerRect.y}
        />
        <Rect
          fill={palette.canvas}
          height={privatePassBrandMark.innerRect.height}
          rx={privatePassBrandMark.innerRect.rx}
          stroke={palette.hintOfGrey}
          strokeWidth={4}
          width={privatePassBrandMark.innerRect.width}
          x={privatePassBrandMark.innerRect.x}
          y={privatePassBrandMark.innerRect.y}
        />
        <Path d={privatePassBrandMark.shieldPath} fill={palette.ink} />
        <Path
          d={privatePassBrandMark.checkPath}
          fill="none"
          stroke={palette.canvas}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={8}
        />
      </Svg>
      <Text style={styles.wordmark}>{privatePassWordmark}</Text>
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
