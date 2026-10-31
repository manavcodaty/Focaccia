import { cn } from '@/lib/utils';
import { fractionForValue, valueAtPosition, type SliderRange } from '@/lib/slider-math';
import * as SliderPrimitive from '@rn-primitives/slider';
import * as React from 'react';
import { PanResponder, View, type GestureResponderEvent } from 'react-native';

const THUMB = 22;

/**
 * shadcn-style slider. @rn-primitives/slider supplies the accessible slider semantics
 * (role, value, VoiceOver increment/decrement); this adds dragging. The slider claims a
 * touch only once it moves mostly sideways, so a vertical swipe that starts on it still
 * scrolls the screen instead of changing the value. The drag area is the full 44pt row.
 */
function Slider({
  accessibilityLabel,
  className,
  disabled = false,
  max,
  min,
  onValueChange,
  step = 1,
  value,
  ...props
}: Omit<React.ComponentProps<typeof View>, 'children'> & {
  disabled?: boolean;
  max: number;
  min: number;
  onValueChange(value: number): void;
  step?: number;
  value: number;
}) {
  const railRef = React.useRef<View>(null);
  const trackLeft = React.useRef(0);
  const trackWidth = React.useRef(0);
  const range: SliderRange = { max, min, step };
  const latest = React.useRef({ onValueChange, range, value });
  latest.current = { onValueChange, range, value };

  const measureRail = React.useCallback((then?: () => void) => {
    railRef.current?.measure((_x, _y, width, _height, left) => {
      trackLeft.current = left;
      trackWidth.current = width;
      then?.();
    });
  }, []);

  const emit = React.useCallback((pageX: number) => {
    // Until the rail has been measured there is no position to map a touch onto.
    if (trackWidth.current <= 0) return;
    const next = valueAtPosition(pageX - trackLeft.current, trackWidth.current, latest.current.range);
    if (next !== latest.current.value) latest.current.onValueChange(next);
  }, []);

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !disabled && Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: (event: GestureResponderEvent) => {
          const { pageX } = event.nativeEvent;
          // Re-measure on every touch: the rail moves when the screen scrolls or rotates.
          measureRail(() => emit(pageX));
        },
        onPanResponderMove: (event) => emit(event.nativeEvent.pageX),
        // Once a sideways drag owns the touch, don't hand it to the ScrollView mid-drag.
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => false,
      }),
    [disabled, emit, measureRail],
  );

  const percent = `${fractionForValue(value, range) * 100}%` as const;

  return (
    <SliderPrimitive.Root
      className={cn('w-full', disabled && 'opacity-50', className)}
      disabled={disabled}
      max={max}
      min={min}
      onValueChange={(values) => {
        const next = values[0];
        if (typeof next === 'number') onValueChange(next);
      }}
      step={step}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track asChild>
        {/* Rail inset by half a thumb so the thumb stays inside the slider at both ends. */}
        <View
          accessibilityLabel={accessibilityLabel}
          className="h-11 justify-center"
          style={{ paddingHorizontal: THUMB / 2 }}
          {...responder.panHandlers}
        >
          <View className="justify-center" onLayout={() => measureRail()} ref={railRef} style={{ height: THUMB }}>
            <View className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <SliderPrimitive.Range className="bg-primary h-full rounded-full" style={{ width: percent }} />
            </View>
            <SliderPrimitive.Thumb
              className="border-primary bg-background absolute top-0 rounded-full border-2"
              style={{ height: THUMB, left: percent, marginLeft: -THUMB / 2, width: THUMB }}
            />
          </View>
        </View>
      </SliderPrimitive.Track>
    </SliderPrimitive.Root>
  );
}

export { Slider };
