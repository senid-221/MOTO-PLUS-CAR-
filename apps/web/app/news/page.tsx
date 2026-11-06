import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { InfoPage } from '@/components/InfoPage';
import { MarketIcon, MonthlyIcon, ServicesIcon } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const ITEMS = [
  { title: 'news.launch.title', desc: 'news.launch.desc', Icon: ServicesIcon },
  { title: 'news.area.title', desc: 'news.area.desc', Icon: MarketIcon },
  { title: 'news.change.title', desc: 'news.change.desc', Icon: MonthlyIcon },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  const t = makeTranslator(language);
  return { title: t('nav.news'), description: t('news.lead') };
}

/**
 * Nothing is published here yet, so the page says so. The three cards explain what
 * an announcement will be once there is a channel for them; the empty line is the
 * real state of that channel rather than a placeholder article.
 */
export default async function NewsPage() {
  const language = await resolveLanguage();

  return (
    <InfoPage
      language={language}
      title="news.title"
      lead="news.lead"
      items={ITEMS}
      actions={[{ href: '/contact', label: 'nav.contact' }]}
      notes={[{ body: 'news.empty' }, { heading: 'page.status.title', body: 'page.status.body' }]}
    />
  );
}
