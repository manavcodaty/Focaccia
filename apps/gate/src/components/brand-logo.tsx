import { privatePassBrandMark, privatePassWordmark } from '@face-pass/shared';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { THEME } from '@/lib/theme';

/** Same lockup as the tickets and organizer apps: ticket mark + 15px semibold wordmark. */
export function BrandLogo() {
  return (
    <View
      accessibilityLabel={privatePassWordmark}
      accessibilityRole="image"
      accessible
      className="flex-row items-center gap-2"
    >
      <Svg height={20} viewBox={privatePassBrandMark.ticket.viewBox} width={20}>
        <Path
          clipRule="evenodd"
          d={privatePassBrandMark.ticket.path}
          fill={THEME.light.foreground}
          fillRule="evenodd"
        />
      </Svg>
      <Text className="text-[15px] font-semibold tracking-tight">{privatePassWordmark}</Text>
    </View>
  );
}
