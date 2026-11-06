import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { REPO_URL } from '@/lib/env';
import { InfoPage, type InfoItem } from '@/components/InfoPage';
import { AccountIcon, ContactIcon, CooperativeIcon } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const ITEMS: readonly InfoItem[] = [
  {
    title: 'contact.account.title',
    desc: 'contact.account.desc',
    Icon: AccountIcon,
    href: '/login',
    linkLabel: 'nav.login',
  },
  {
    title: 'contact.build.title',
    desc: 'contact.build.desc',
    Icon: ContactIcon,
    href: REPO_URL,
    linkLabel: 'contact.build.link',
    external: true,
  },
  { title: 'contact.open.title', desc: 'contact.open.desc', Icon: CooperativeIcon },
];

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  const t = makeTranslator(language);
  return { title: t('nav.contact'), description: t('contact.lead') };
}

/**
 * Only the channels that exist are listed. A support phone number and email
 * address are not published yet, and inventing one on a contact page is the worst
 * possible place for it, so the note says what is missing and the repository link
 * — which is real — carries the technical route.
 */
export default async function ContactPage() {
  const language = await resolveLanguage();

  return (
    <InfoPage
      language={language}
      title="contact.title"
      lead="contact.lead"
      items={ITEMS}
      notes={[{ body: 'contact.note' }]}
    />
  );
}
