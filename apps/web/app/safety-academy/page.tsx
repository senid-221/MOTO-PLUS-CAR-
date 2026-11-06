import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { InfoPage } from '@/components/InfoPage';
import { HelmetIcon, NightRideIcon, RideIcon } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const ITEMS = [
  { title: 'safety.before.title', desc: 'safety.before.desc', Icon: HelmetIcon },
  { title: 'safety.road.title', desc: 'safety.road.desc', Icon: RideIcon },
  { title: 'safety.night.title', desc: 'safety.night.desc', Icon: NightRideIcon },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  const t = makeTranslator(language);
  return { title: t('nav.safety'), description: t('safety.lead') };
}

/**
 * General road-safety reminders in the two launch languages. This is guidance, not
 * a certificate or a rule book: the page says which authority actually issues the
 * rules that bind a rider, so nobody reads these three cards as the law.
 */
export default async function SafetyAcademyPage() {
  const language = await resolveLanguage();

  return (
    <InfoPage
      language={language}
      title="safety.title"
      lead="safety.lead"
      items={ITEMS}
      actions={[{ href: '/#services', label: 'nav.services' }]}
      notes={[{ body: 'safety.note' }]}
    />
  );
}
