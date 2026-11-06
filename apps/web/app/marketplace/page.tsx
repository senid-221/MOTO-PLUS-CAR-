import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { InfoPage } from '@/components/InfoPage';
import { CargoIcon, MarketIcon, ShoppingIcon } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const ITEMS = [
  { title: 'marketplace.buy.title', desc: 'marketplace.buy.desc', Icon: ShoppingIcon },
  { title: 'marketplace.sell.title', desc: 'marketplace.sell.desc', Icon: MarketIcon },
  { title: 'marketplace.deliver.title', desc: 'marketplace.deliver.desc', Icon: CargoIcon },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  const t = makeTranslator(language);
  return { title: t('nav.marketplace'), description: t('marketplace.lead') };
}

/**
 * The marketplace is described, not demonstrated: there is no catalogue endpoint
 * yet, so the page names what sellers and buyers will do and states plainly that
 * nothing on it is a live offer. Inventing a part, a price or a shop here would be
 * a fake record, which the product specification forbids.
 */
export default async function MarketplacePage() {
  const language = await resolveLanguage();

  return (
    <InfoPage
      language={language}
      title="marketplace.title"
      lead="marketplace.lead"
      items={ITEMS}
      actions={[{ href: '/register', label: 'nav.register' }]}
      notes={[{ heading: 'page.status.title', body: 'page.status.body' }]}
    />
  );
}
