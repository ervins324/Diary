/**
 * Clipboard utility with fallback for non-secure contexts (HTTP).
 * navigator.clipboard.writeText requires HTTPS or localhost.
 * Falls back to document.execCommand('copy') via a temporary textarea.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  /* Try modern Clipboard API first */
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Clipboard API failed (e.g. permission denied), fall through to legacy */
    }
  }

  /* Legacy fallback using a temporary textarea and execCommand */
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    /* Position off-screen to prevent visual flicker */
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
