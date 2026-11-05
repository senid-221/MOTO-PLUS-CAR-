import type { Language } from '@seremoto/shared-types';
import { makeTranslator } from '@/messages';
import { hasAccessTokenCookie } from '@/lib/server-session';
import { LanguageToggle } from './LanguageToggle';

/**
 * The header carries the way in and the way out and nothing else: brand,
 * services, and either Log in or Account. Register and language live one level
 * down so the row stays on one line on a phone.
 */
export async function SiteHeader({ language }: { language: Language }) {
  const t = makeTranslator(language);
  const signedIn = await hasAccessTokenCookie();

  return (
    <header className="site-header">
      <div className="container site-header__row">
        <a className="brand" href="/">
          <span className="brand__dot" aria-hidden="true" />
          {t('brand.name')}
        </a>
        <nav className="site-nav" aria-label={t('nav.home')}>
          <a href="/#services">{t('nav.services')}</a>
          <a href={signedIn ? '/account' : '/login'}>
            {signedIn ? t('nav.account') : t('nav.login')}
          </a>
          <LanguageToggle language={language} />
        </nav>
      </div>
    </header>
  );
}
