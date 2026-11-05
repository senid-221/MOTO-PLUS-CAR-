/**
 * Hand-off for the development SMS stand-in only.
 *
 * When the API runs with SMS_PROVIDER=log outside production, it returns the
 * generated code alongside the SMS it only writes to the server log, so a
 * developer can finish the flow without a phone. The code is kept in
 * sessionStorage for the single hop from the send step to the confirm step and
 * is dropped as soon as it is used or the phone changes.
 *
 * The API withholds this field entirely in production, so nothing reaches
 * storage there, and it is never placed in a URL where history or a referer
 * could keep it.
 */
const STORAGE_KEY = 'sere.dev.otp';

interface Stored {
  phone: string;
  code: string;
}

function available(): boolean {
  return typeof window !== 'undefined' && 'sessionStorage' in window;
}

export function rememberDevOtp(phone: string, code: string | undefined | null): void {
  if (!available() || !code) return;
  try {
    const value: Stored = { phone, code };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private browsing can block storage; the SMS log in the API console still has the code.
  }
}

export function readDevOtp(phone: string): string | null {
  if (!available()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    return stored.phone === phone ? stored.code : null;
  } catch {
    return null;
  }
}

export function forgetDevOtp(): void {
  if (!available()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
