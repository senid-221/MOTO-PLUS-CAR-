import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
/*
 * Poppins is self-hosted through @fontsource rather than pulled from a font CDN
 * at runtime: the reference design is defined by this face, and the app must
 * render it identically on a network the CDN is slow to reach. Weights follow the
 * reference sheet — 400 body, 500 navigation, 600 headings, 700/800 labels and
 * 900 for the hero title.
 */
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import '@fontsource/poppins/900.css';
/*
 * Oswald is only ever used for the two words of the brand mark under the logo, so
 * it is self-hosted as the latin subset at one weight: the wordmark needs to read
 * as the logo's own typeface rather than as the Poppins UI around it, and a
 * condensed grotesque matches the speed lines in the artwork.
 */
import '@fontsource/oswald/latin-600.css';
import './globals.css';
import { WEB_URL } from '@/lib/env';
import { resolveLanguage } from '@/lib/locale';
import { makeTranslator } from '@/messages';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { RouteProgress } from '@/components/RouteProgress';

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
  themeColor: '#014e84',
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
        <RouteProgress language={language} />
        <SiteHeader language={language} />
        <main id="main">{children}</main>
        <SiteFooter language={language} />
      </body>
    </html>
  );
}
