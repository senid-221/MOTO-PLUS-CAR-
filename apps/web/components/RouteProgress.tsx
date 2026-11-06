'use client';

/**
 * A thin bar across the top while a route is loading.
 *
 * Every screen here is rendered on the server from the hosted API, so a tap on a
 * link can take a second or more before the new page arrives. Without feedback
 * the interface simply looks frozen, and the honest signal is the one this
 * component gives: work started, work not finished.
 *
 * It starts when the visitor presses an internal link and stops when the address
 * actually changes, so nothing here invents a duration. A safety timeout clears
 * it if a navigation never lands (a refused request, a dead tab), and the bar is
 * decorative only — the text below it is what a screen reader announces.
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Language } from '@seremoto/shared-types';
import { makeTranslator } from '@/messages';

/** Longest the bar is allowed to sit without a route change. */
const STALL_LIMIT_MS = 20_000;

function isInternalSameTab(anchor: HTMLAnchorElement, href: string): boolean {
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/** A link that only moves the scroll position within this page loads nothing. */
function isHashOnly(href: string): boolean {
  try {
    const url = new URL(href, window.location.origin);
    return (
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    );
  } catch {
    return false;
  }
}

export function RouteProgress({ language }: { language: Language }) {
  const t = makeTranslator(language);
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute('href');
      if (!href || !isInternalSameTab(anchor, href) || isHashOnly(href)) return;
      setBusy(true);
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // The route committed: the bar's job is done.
  useEffect(() => {
    setBusy(false);
  }, [pathname]);

  useEffect(() => {
    if (!busy) return;
    const stall = setTimeout(() => setBusy(false), STALL_LIMIT_MS);
    return () => clearTimeout(stall);
  }, [busy]);

  if (!busy) return null;

  return (
    <div className="route-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
      <span className="route-progress__bar" />
      <span className="visually-hidden" role="status">
        {t('common.loading')}
      </span>
    </div>
  );
}
