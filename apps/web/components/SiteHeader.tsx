import Link from 'next/link';
import type { Language } from '@seremoto/shared-types';
import { makeTranslator } from '@/messages';
import { PrimaryNav } from './PrimaryNav';
import { LanguageToggle } from './LanguageToggle';

/**
 * One navbar row and nothing else: the brand mark with its name underneath, the
 * pill navigation to its right, and the language choice at the far edge. Signing
 * in is not here — it is the landing page's own call to action and a footer link —
 * so the header has no strip above the logo and no account button beside it. The
 * nav is client-side so it can mark the route on screen as the current page and so
 * a tap stays an in-app route change instead of a full document reload; nothing on
 * this row depends on who is signed in.
 *
 * Below 48rem the pills leave for the tab bar at the bottom of the screen, and the
 * header keeps the brand plus the language chips.
 */
export async function SiteHeader({ language }: { language: Language }) {
  const t = makeTranslator(language);

  return (
    <header className="site-header">
      <div className="container site-header__row">
        <Link className="brand" href="/" aria-label={t('brand.name')}>
          {/*
            The artwork carries no lettering, so the image is decorative and the
            name underneath is what screen readers and the share card read. The
            256 px file is already 5.5x the 46 px it draws at; the 512 candidate is
            there for the densest phones.
          */}
          <img
            className="brand__mark"
            src="/brand/seremoto-logo-256.png"
            srcSet="/brand/seremoto-logo-256.png 256w, /brand/seremoto-logo.png 512w"
            sizes="(max-width: 30rem) 38px, 46px"
            width={45}
            height={46}
            alt=""
            fetchPriority="high"
          />
          <span className="brand__name">{t('brand.name')}</span>
        </Link>
        <PrimaryNav language={language} />
        <LanguageToggle language={language} />
      </div>
    </header>
  );
}
