import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WEB_URL } from '@/lib/env';
import { resolveLanguage } from '@/lib/locale';
import { makeTranslator } from '@/messages';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * The shell resolves the visitor's language on every request, so a language
 * switch (or a new browser) is reflected without a rebuild. Nothing here is
 * statically cached: the page must know the cookie, and the API it feeds from is
 * live data.
 */
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a1b2e',
};

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  const t = makeTranslator(language);

  return {
    metadataBase: new URL(WEB_URL),
    title: {
      default: `${t('brand.name')} — ${t('brand.tagline')}`,
      template: `%s · ${t('brand.name')}`,
    },
    description: t('home.hero.subtitle'),
    alternates: { languages: { 'rw-RW': '/', 'en-US': '/' } },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const language = await resolveLanguage();
  const t = makeTranslator(language);

  return (
    <html lang={language}>
      <body>
        <a className="skip-link" href="#main">
          {t('common.skip_to_content')}
        </a>
        <SiteHeader language={language} />
        <main id="main">{children}</main>
        <SiteFooter language={language} />
      </body>
    </html>
  );
}
