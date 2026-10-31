import { useRouter } from 'expo-router';
import { CheckIcon, TicketXIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ScreenShell } from '@/components/screen-shell';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useEnrollment } from '@/state/enrollment-context';

const ON_DEVICE = [
  'Your face is processed on-device.',
  'Temporary captures are deleted best-effort.',
  'Face images, embeddings, and unencrypted templates are not saved to your account.',
];

const SENT = [
  'Your ticket ID and an encrypted template.',
  'Never a face image or password.',
];

function Disclosure({ items }: { items: string[] }) {
  return (
    <Card>
      <CardContent className="gap-3">
        {items.map((item) => (
          <View className="flex-row gap-3" key={item}>
            <Icon as={CheckIcon} className="text-muted-foreground mt-0.5" size={16} />
            <Text className="flex-1 text-sm leading-5">{item}</Text>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ConsentScreen() {
  const router = useRouter();
  const { acceptConsent, state } = useEnrollment();

  if (!state.selectedTicket || !state.bundle) {
    return (
      <ScreenShell>
        <EmptyState icon={TicketXIcon} title="No ticket selected">
          <Button onPress={() => router.replace('/tickets')}><Text>My tickets</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <Text variant="h1">Consent</Text>
      <Section title="On your iPhone">
        <Disclosure items={ON_DEVICE} />
      </Section>
      <Section title="Sent for signing">
        <Disclosure items={SENT} />
      </Section>
      <Button
        onPress={() => {
          acceptConsent();
          router.push('/capture');
        }}
      >
        <Text>Agree and continue</Text>
      </Button>
    </ScreenShell>
  );
}
