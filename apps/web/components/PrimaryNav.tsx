'use client';

/**
 * The two navigation surfaces, built from one item list.
 *
 * On a desktop this renders the navbar row: the seven destinations sit to the
 * right of the brand as pills, each one a real client route, and the item whose
 * route is on screen carries `aria-current="page"` so the browser paints it filled
 * navy with the lime underline. Measured in Kinyarwanda — the wider of the two
 * languages — that row wants 1 019 px, so below 68rem the same list becomes a fixed
 * tab bar at the bottom of the screen instead. The destinations keep their words
 * there, where seven columns are over 100 px wide, and under 48rem, at 55 px a
 * column, the word moves into the accessible name and the tooltip and the icon
 * stays. Nothing is hidden behind a hamburger at any width.
 *
 * Only CSS decides which surface shows, so a width change never re-renders the
 * route and the signed-in state stays whatever the server resolved.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Language } from '@seremoto/shared-types';
import { makeTranslator } from '@/messages';
import {
  AboutIcon,
  ContactIcon,
  HomeIcon,
  MarketIcon,
  NewsIcon,
  SafetyIcon,
  ServicesIcon,
} from './Icons';

/**
 * The whole nav, in the order it is asked for. Services is a section of the
 * landing page rather than a route, so it is the one destination that can never
 * claim to be the current page.
 */
const DESTINATIONS = [
  { key: 'home', href: '/', labelKey: 'nav.home', Icon: HomeIcon, section: false },
  {
    key: 'services',
    href: '/#services',
    labelKey: 'nav.services',
    Icon: ServicesIcon,
    section: true,
  },
  {
    key: 'marketplace',
    href: '/marketplace',
    labelKey: 'nav.marketplace',
    Icon: MarketIcon,
    section: false,
  },
  { key: 'news', href: '/news', labelKey: 'nav.news', Icon: NewsIcon, section: false },
  {
    key: 'safety',
    href: '/safety-academy',
    labelKey: 'nav.safety',
    Icon: SafetyIcon,
    section: false,
  },
  { key: 'about', href: '/about', labelKey: 'nav.about', Icon: AboutIcon, section: false },
  { key: 'contact', href: '/contact', labelKey: 'nav.contact', Icon: ContactIcon, section: false },
] as const;

export function PrimaryNav({ language }: { language: Language }) {
  const t = makeTranslator(language);
  const pathname = usePathname();

  /* Next reports '/account/' for a trailing-slash request, which would leave the
     pill for that route unmarked, so both sides are compared without it. */
  const on = (href: string) =>
    pathname.replace(/\/$/, '') === href.replace(/\/$/, '') || (href !== '/' && pathname === href);

  return (
    <>
      <nav className="site-nav site-nav--desktop" aria-label={t('nav.label.main')}>
        {DESTINATIONS.map(({ key, href, labelKey, Icon, section }) => {
          const current = !section && on(href);
          return (
            <Link
              key={key}
              href={href}
              className="nav-link"
              aria-current={current ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      <nav className="tab-bar" aria-label={t('nav.label.tabs')}>
        {DESTINATIONS.map(({ key, href, labelKey, Icon, section }) => {
          const current = !section && on(href);
          const label = t(labelKey);
          return (
            <Link
              key={key}
              href={href}
              className="tab"
              aria-current={current ? 'page' : undefined}
              aria-label={label}
              title={label}
            >
              <Icon size={24} aria-hidden />
              <span className="tab__label">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
