import Link from 'next/link';
import type { Language } from '@seremoto/shared-types';
import { makeTranslator, type TranslationKey } from '@/messages';
import { hasAccessTokenCookie } from '@/lib/server-session';

/**
 * The ways in that the header leaves out: creating an account and signing in. The
 * seven destinations are repeated here in text, which is what a visitor expects at
 * the end of a page and what a crawler follows, and it reads the same access cookie
 * as the header so the last link points at the screen the visitor is actually on the
 * way to.
 */
const PAGES: readonly { href: string; labelKey: TranslationKey }[] = [
  { href: '/', labelKey: 'nav.home' },
  { href: '/#services', labelKey: 'nav.services' },
  { href: '/marketplace', labelKey: 'nav.marketplace' },
  { href: '/news', labelKey: 'nav.news' },
  { href: '/safety-academy', labelKey: 'nav.safety' },
  { href: '/about', labelKey: 'nav.about' },
  { href: '/contact', labelKey: 'nav.contact' },
];

export async function SiteFooter({ language }: { language: Language }) {
  const t = makeTranslator(language);
  const signedIn = await hasAccessTokenCookie();

  return (
    <footer className="site-footer">
      <div className="container">
        <nav className="footer-nav" aria-label={t('nav.label.footer')}>
          {PAGES.map(({ href, labelKey }) => (
            <Link href={href} key={href}>
              {t(labelKey)}
            </Link>
          ))}
          {signedIn ? (
            <Link href="/account">{t('nav.account')}</Link>
          ) : (
            <>
              <Link href="/register">{t('nav.register')}</Link>
              <Link href="/login">{t('nav.login')}</Link>
            </>
          )}
        </nav>
        <div className="site-footer__row">
          <p>
            {t('brand.name')} — {t('brand.tagline')}
          </p>
          <p>{t('footer.location')}</p>
        </div>
      </div>
    </footer>
  );
}
