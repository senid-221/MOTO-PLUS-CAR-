/**
 * One-line result feedback for a form: what went wrong, or what just happened.
 * The message is always localised by the caller, never copied from the server.
 * Errors are announced as an alert; confirmations as a polite live region.
 */
export type Tone = 'error' | 'success' | 'info';

const ICONS: Record<Tone, string> = { error: '!', success: '✓', info: 'i' };

export function StatusMessage({ tone, message }: { tone: Tone; message: string }) {
  if (!message) return null;

  return (
    <div className={`status status--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true">{ICONS[tone]}</span>
      <span>{message}</span>
    </div>
  );
}
