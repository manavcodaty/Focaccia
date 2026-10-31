import { View } from 'react-native';

import { cn } from '@/lib/utils';

/** A face-shaped frame; turns success-green once capture is possible. */
export function CameraGuide({ ready }: { ready: boolean }) {
  return (
    <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
      <View
        className={cn(
          'aspect-[3/4] w-[68%] max-w-[320px] rounded-[999px] border-2',
          ready ? 'border-success' : 'border-white/70',
        )}
      />
    </View>
  );
}
