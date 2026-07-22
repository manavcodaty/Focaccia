'use client';

import { useState } from 'react';

import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-live="polite" onClick={copy} size="sm" type="button" variant="outline">
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? 'Copied' : 'Copy code'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Claim code copied' : 'Copy the claim code'}</TooltipContent>
    </Tooltip>
  );
}
