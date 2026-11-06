import type { Metadata } from 'next';
import Link from 'next/link';
import { makeTranslator, type TranslationKey } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import type { AppIcon } from '@/components/Icons';
import {
  CargoIcon,
  CodeStepIcon,
  CooperativeIcon,
  MarketIcon,
  MonthlyIcon,
  PhoneStepIcon,
  RideIcon,
  ShoppingIcon,
} from '@/components/Icons';

/**
 * The landing page lists what the platform does and the two ways in. It shows
 * no numbers, no testimonials and no "trusted by" counts, because there is no
 * backend query behind them yet — invented statistics are forbidden by the
 * product specification. Each tile says one thing the app will do, in the two
 * launch languages, and nothing more.
 */
const SERVICES: readonly { title: TranslationKey; blurb: TranslationKey; Icon: AppIcon }[] = [
  { title: 'services.ride', blurb: 'services.ride.desc', Icon: RideIcon },
  { title: 'services.cargo', blurb: 'services.cargo.desc', Icon: CargoIcon },
  { title: 'services.shopping', blurb: 'services.shopping.desc', Icon: ShoppingIcon },
  { title: 'services.monthly', blurb: 'services.monthly.desc', Icon: MonthlyIcon },
  { title: 'services.marketplace', blurb: 'services.marketplace.desc', Icon: MarketIcon },
  { title: 'services.cooperative', blurb: 'services.cooperative.desc', Icon: CooperativeIcon },
];

/**
 * The three screens a visitor actually goes through to get an account. The copy
 * describes the flow that is built and running — number, code, roles — and the
 * step indicator on those screens uses the same three labels.
 */
const HOW: readonly { title: TranslationKey; desc: TranslationKey; tone: 'c1' | 'c2' | 'c3' }[] = [
  { title: 'home.how.step1.title', desc: 'home.how.step1.desc', tone: 'c1' },
  { title: 'home.how.step2.title', desc: 'home.how.step2.desc', tone: 'c2' },
  { title: 'home.how.step3.title', desc: 'home.how.step3.desc', tone: 'c3' },
];

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  const t = makeTranslator(language);
  return { title: t('nav.home'), description: t('home.hero.subtitle') };
}

export default async function HomePage() {
  const language = await resolveLanguage();
  const t = makeTranslator(language);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div>
            <h1>{t('home.hero.title')}</h1>
            <p>{t('home.hero.subtitle')}</p>
            <div className="hero__actions">
              <Link className="btn btn--hero" href="/register">
                {t('home.cta.start')}
              </Link>
              <Link className="btn btn--hero" href="/login">
                {t('nav.login')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The services sit on the same navy band, as in the reference layout: the
          heading is lime with a lime rule beside it, and each service is an icon
          circle that turns lime when the pointer reaches it. */}
      <section className="section--navy" id="services">
        <div className="container">
          <div className="section-rule">
            <h2>{t('home.services.title')}</h2>
            <hr className="section-rule__line" aria-hidden="true" />
          </div>
          <div className="service-grid">
            {SERVICES.map(({ title, blurb, Icon }) => (
              <article className="service" key={title}>
                <span className="service__icon">
                  <Icon size={30} aria-hidden />
                </span>
                <h3>{t(title)}</h3>
                <p>{t(blurb)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="steps-band" id="how">
        <div className="container">
          <h2>{t('home.how.title')}</h2>
          <div className="step-grid">
            {HOW.map(({ title, desc, tone }, index) => (
              <article className="step-card" key={title}>
                <span className={`step-icon-wrap step-icon-wrap--${tone}`} aria-hidden="true">
                  <StepNumberIcon index={index} />
                </span>
                <p className="step-meta">
                  {t('common.step')}
                  <span className="step-number">{index + 1}</span>
                </p>
                <p className="step-desc">
                  <strong>{t(title)}</strong>
                  {t(desc)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * The disc holds the icon of the screen that step belongs to, so the row reads
 * as the product rather than as generic numbered boxes.
 */
function StepNumberIcon({ index }: { index: number }) {
  const Icon = [PhoneStepIcon, CodeStepIcon, CooperativeIcon][index] ?? CooperativeIcon;
  return <Icon size={34} aria-hidden />;
}
