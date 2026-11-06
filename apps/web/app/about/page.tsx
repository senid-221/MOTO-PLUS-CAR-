import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { InfoPage } from '@/components/InfoPage';
import { CooperativeIcon, RideIcon, ServicesIcon } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const ITEMS = [
  { title: 'about.what.title', desc: 'about.what.desc', Icon: ServicesIcon },
  { title: 'about.who.title', desc: 'about.who.desc', Icon: CooperativeIcon },
  { title: 'about.how.title', desc: 'about.how.desc', Icon: RideIcon },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  const t = makeTranslator(language);
  return { title: t('nav.about'), description: t('about.lead') };
}

/**
 * What the product is, who it serves and how it is governed. The last card is the
 * one that matters for trust: roles decide what an account may see, and a
 * privileged action is written down. The status note underneath is the honest
 * version of how much of that is running today.
 */
export default async function AboutPage() {
  const language = await resolveLanguage();

  return (
    <InfoPage
      language={language}
      title="about.title"
      lead="about.lead"
      items={ITEMS}
      actions={[
        { href: '/#services', label: 'nav.services' },
        { href: '/contact', label: 'nav.contact' },
      ]}
      notes={[{ heading: 'page.status.title', body: 'page.status.body' }]}
    />
  );
}
