'use client';

import { useState } from 'react';

import { CheckIcon, CopyIcon } from './icons';

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button aria-live="polite" className="copy-button" onClick={copy} type="button">
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : 'Copy code'}
    </button>
  );
}
