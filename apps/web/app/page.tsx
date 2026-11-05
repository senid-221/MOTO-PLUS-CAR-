import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';

/**
 * The landing page lists what the platform does and the two ways in. It shows
 * no numbers, no testimonials and no "trusted by" counts, because there is no
 * backend query behind them yet — invented statistics are forbidden by the
 * product specification.
 */
const SERVICE_KEYS = [
  'services.ride',
  'services.cargo',
  'services.shopping',
  'services.monthly',
  'services.marketplace',
  'services.cooperative',
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  const t = makeTranslator(language);
  return { title: t('nav.home'), description: t('home.hero.subtitle') };
}

export default async function HomePage() {
  const language = await resolveLanguage();
  const t = makeTranslator(language);

  return (
    <div className="container">
      <section className="hero">
        <h1>{t('home.hero.title')}</h1>
        <p>{t('home.hero.subtitle')}</p>
        <div className="hero__actions">
          <a className="btn btn--primary" href="/register">
            {t('home.cta.start')}
          </a>
          <a className="btn btn--secondary" href="/login">
            {t('nav.login')}
          </a>
        </div>
      </section>

      <section className="section" id="services">
        <div className="section__head">
          <h2>{t('home.services.title')}</h2>
        </div>
        <div className="service-grid">
          {SERVICE_KEYS.map((key) => (
            <article className="service" key={key}>
              <h3>{t(key)}</h3>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
