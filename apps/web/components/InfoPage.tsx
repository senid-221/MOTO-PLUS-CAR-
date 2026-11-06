import Link from 'next/link';
import type { Language } from '@seremoto/shared-types';
import { makeTranslator, type TranslationKey } from '@/messages';
import type { AppIcon } from '@/components/Icons';

/**
 * The shape the public content pages share: the navy band naming the page, three
 * cards saying what the page is about, and underneath them the note that says what
 * is actually running. One component means one layout and one spacing rhythm
 * across the whole nav, and it keeps the copy honest in both languages — a page
 * describes the product instead of inventing listings, prices or announcements.
 */
export type InfoItem = {
  title: TranslationKey;
  desc: TranslationKey;
  Icon: AppIcon;
  /** Optional way out of the card, e.g. the repository or the sign-in screen. */
  href?: string;
  linkLabel?: TranslationKey;
  external?: boolean;
};

export type InfoAction = { href: string; label: TranslationKey };
export type InfoNote = { heading?: TranslationKey; body: TranslationKey };

export function InfoPage({
  language,
  title,
  lead,
  items,
  actions = [],
  notes = [],
}: {
  language: Language;
  title: TranslationKey;
  lead: TranslationKey;
  items: readonly InfoItem[];
  actions?: readonly InfoAction[];
  notes?: readonly InfoNote[];
}) {
  const t = makeTranslator(language);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div>
            <h1>{t(title)}</h1>
            <p>{t(lead)}</p>
            {actions.length > 0 && (
              <div className="hero__actions">
                {actions.map(({ href, label }) => (
                  <Link className="btn btn--hero" href={href} key={href}>
                    {t(label)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="info-grid">
            {items.map(({ title: itemTitle, desc, Icon, href, linkLabel, external }) => (
              <article className="card info-card" key={itemTitle}>
                <span className="info-card__icon">
                  <Icon size={26} aria-hidden />
                </span>
                <h2 className="info-card__title">{t(itemTitle)}</h2>
                <p>{t(desc)}</p>
                {href && linkLabel ? (
                  external ? (
                    <a
                      className="section__link"
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {t(linkLabel)}
                    </a>
                  ) : (
                    <Link className="section__link" href={href}>
                      {t(linkLabel)}
                    </Link>
                  )
                ) : null}
              </article>
            ))}
          </div>

          {notes.map(({ heading, body }) => (
            <div className="card info-note" key={body}>
              {heading ? <h2>{t(heading)}</h2> : null}
              <p className="card__note">{t(body)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
