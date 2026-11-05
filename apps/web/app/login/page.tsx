import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  return { title: makeTranslator(language)('nav.login') };
}

export default async function LoginPage() {
  const language = await resolveLanguage();
  const t = makeTranslator(language);

  return (
    <div className="container narrow">
      <div className="card">
        <h1>{t('auth.login.title')}</h1>
        <p>{t('auth.login.subtitle')}</p>
        <LoginForm language={language} />
      </div>
    </div>
  );
}
