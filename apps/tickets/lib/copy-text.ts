/**
 * Copies text, falling back to a hidden textarea when the async Clipboard API is
 * unavailable (plain-HTTP LAN origins are not secure contexts).
 */
export async function copyText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy command was rejected.');
}
