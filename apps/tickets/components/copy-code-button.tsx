'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/copy-text';

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await copyText(code);
      setCopied(true);
      toast.success('Claim code copied.');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Clipboard unavailable. Select the code and copy it manually.');
    }
  }

  return (
    <Button aria-live="polite" onClick={() => void copy()} type="button" variant="outline">
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {copied ? 'Copied' : 'Copy code'}
    </Button>
  );
}
