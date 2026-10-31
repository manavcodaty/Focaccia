import { AlertCircleIcon, InfoIcon } from 'lucide-react-native';

import { Alert, AlertTitle } from '@/components/ui/alert';

/** A one-line alert: the message is the title, nothing else. */
export function InlineAlert({ message, tone = 'destructive' }: { message: string; tone?: 'default' | 'destructive' }) {
  return (
    <Alert
      accessibilityLiveRegion={tone === 'destructive' ? 'assertive' : 'polite'}
      icon={tone === 'destructive' ? AlertCircleIcon : InfoIcon}
      variant={tone}
    >
      <AlertTitle>{message}</AlertTitle>
    </Alert>
  );
}
