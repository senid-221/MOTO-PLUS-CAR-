import type { Metadata } from 'next';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { RegisterForm } from '@/components/RegisterForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  return { title: makeTranslator(language)('nav.register') };
}

export default async function RegisterPage() {
  const language = await resolveLanguage();
  const t = makeTranslator(language);

  return (
    <div className="container narrow">
      <div className="card">
        <h1>{t('auth.register.title')}</h1>
        <RegisterForm language={language} />
      </div>
    </div>
  );
}
