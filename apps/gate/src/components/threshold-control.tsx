import { MinusIcon, PlusIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';
import { THRESHOLD_RANGE, thresholdTone } from '@/lib/gate-presentation';
import { snapValue } from '@/lib/slider-math';
import { cn } from '@/lib/utils';

/**
 * Live Hamming-distance threshold for demonstrations: a face is accepted when the
 * distance to the enrolled template is at or below this value.
 */
export function ThresholdControl({
  calibratedMax,
  defaultValue,
  disabled = false,
  onChange,
  value,
}: {
  calibratedMax: number;
  defaultValue: number;
  disabled?: boolean;
  onChange(value: number | null): void;
  value: number;
}) {
  const set = (next: number) => {
    const snapped = snapValue(next, THRESHOLD_RANGE);
    onChange(snapped === defaultValue ? null : snapped);
  };
  const tone = thresholdTone(value, calibratedMax);

  return (
    <Card className="gap-2 py-3">
      {/* Fixed height so showing Reset never shifts the slider under the operator's finger. */}
      <CardContent className="min-h-9 flex-row items-center justify-between gap-4">
        <Text accessibilityLabel={`Accept at distance ${value} or less`} className={cn('shrink text-xl font-semibold', tone === 'warning' && 'text-warning')}>
          ≤ {value}
        </Text>
        {value !== defaultValue ? (
          <Button disabled={disabled} onPress={() => onChange(null)} size="sm" variant="ghost">
            <Text>Reset to {defaultValue}</Text>
          </Button>
        ) : null}
      </CardContent>
      <CardContent className="flex-row items-center gap-2">
        <Button
          accessibilityLabel="Lower threshold"
          disabled={disabled || value <= THRESHOLD_RANGE.min}
          onPress={() => set(value - THRESHOLD_RANGE.step)}
          size="icon"
          variant="outline"
        >
          <Icon as={MinusIcon} size={16} />
        </Button>
        <View className="flex-1">
          <Slider
            accessibilityLabel="Match threshold"
            disabled={disabled}
            max={THRESHOLD_RANGE.max}
            min={THRESHOLD_RANGE.min}
            onValueChange={set}
            step={THRESHOLD_RANGE.step}
            value={value}
          />
        </View>
        <Button
          accessibilityLabel="Raise threshold"
          disabled={disabled || value >= THRESHOLD_RANGE.max}
          onPress={() => set(value + THRESHOLD_RANGE.step)}
          size="icon"
          variant="outline"
        >
          <Icon as={PlusIcon} size={16} />
        </Button>
      </CardContent>
    </Card>
  );
}
