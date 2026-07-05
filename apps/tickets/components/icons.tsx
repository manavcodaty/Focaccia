import type { IconProps } from '@phosphor-icons/react';
import {
  ArrowRight,
  CalendarBlank,
  Check,
  ClipboardText,
  Copy,
  MapPinArea,
  Ticket,
} from '@phosphor-icons/react/dist/ssr';

const iconDefaults = {
  'aria-hidden': true,
  size: 20,
  weight: 'regular',
} satisfies Partial<IconProps>;

export function ArrowIcon(props: IconProps) {
  return <ArrowRight {...iconDefaults} {...props} />;
}

export function CalendarIcon(props: IconProps) {
  return <CalendarBlank {...iconDefaults} {...props} />;
}

export function CheckIcon(props: IconProps) {
  return <Check {...iconDefaults} {...props} />;
}

export function ClipboardIcon(props: IconProps) {
  return <ClipboardText {...iconDefaults} {...props} />;
}

export function CopyIcon(props: IconProps) {
  return <Copy {...iconDefaults} {...props} />;
}

export function LocationIcon(props: IconProps) {
  return <MapPinArea {...iconDefaults} {...props} />;
}

export function TicketIcon(props: IconProps) {
  return <Ticket {...iconDefaults} {...props} />;
}
