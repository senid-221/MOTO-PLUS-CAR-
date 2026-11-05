import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { AccountPanel } from '@/components/AccountPanel';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  return { title: makeTranslator(language)('auth.profile.title') };
}

export default async function AccountPage() {
  const language = await resolveLanguage();
  const t = makeTranslator(language);

  return (
    <div className="container narrow">
      <div className="card">
        <h1>{t('auth.profile.title')}</h1>
        <AccountPanel language={language} />
        <p className="card__note">{t('auth.profile.note')}</p>
      </div>
    </div>
  );
}
