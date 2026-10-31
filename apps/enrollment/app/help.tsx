import { View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { Section } from '@/components/section';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';

const TOPICS = [
  { items: ['Even light, eyes visible.', 'Phone at eye level.', 'Hold still.'], title: 'Capture' },
  { items: ['Copy the token and show it to gate staff.'], title: 'QR not scanning' },
  { items: ['Face data stays on this phone.'], title: 'Privacy' },
];

export default function HelpScreen() {
  return (
    <ScreenShell>
      <Text variant="h1">Help</Text>
      {TOPICS.map((topic) => (
        <Section key={topic.title} title={topic.title}>
          <Card>
            <CardContent className="gap-2">
              {topic.items.map((item) => (
                <View className="flex-row gap-3" key={item}>
                  <View className="bg-muted-foreground mt-2 h-1 w-1 rounded-full" />
                  <Text className="flex-1 text-sm leading-5">{item}</Text>
                </View>
              ))}
            </CardContent>
          </Card>
        </Section>
      ))}
    </ScreenShell>
  );
}
