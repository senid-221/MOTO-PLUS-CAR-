import type { Metadata } from 'next';
import Link from 'next/link';
import type { OtpPurposeName } from '@seremoto/shared-types';
import { normalizePhone } from '@seremoto/validation';
import { makeTranslator } from '@/messages';
import { resolveLanguage } from '@/lib/locale';
import { VerifyForm } from '@/components/VerifyForm';

export const dynamic = 'force-dynamic';

/** Only the two purposes the API implements for this milestone. */
function readPurpose(raw: string | string[] | undefined): OtpPurposeName | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'REGISTER' || value === 'LOGIN' ? value : null;
}

function readMinutes(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value ?? 5);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.min(60, Math.round(parsed));
}

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveLanguage();
  return { title: makeTranslator(language)('auth.otp.title') };
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const language = await resolveLanguage();
  const t = makeTranslator(language);
  const params = await searchParams;

  const rawPhone = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const normalized = rawPhone ? normalizePhone(rawPhone) : null;
  const purpose = readPurpose(params.purpose);

  // The number and the purpose come from the step that requested the code. A
  // hand-edited or bookmarked address must not start a half-informed verify call.
  if (!normalized || !purpose) {
    return (
      <div className="container narrow">
        <div className="card">
          <h1>{t('state.error.title')}</h1>
          <p>{t('auth.login.subtitle')}</p>
          <div className="form-actions">
            <Link className="btn btn--primary" href="/login">
              {t('nav.login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div className="card">
        <h1>{t('auth.otp.title')}</h1>
        <VerifyForm
          phone={normalized.e164}
          purpose={purpose}
          minutes={readMinutes(params.minutes)}
          language={language}
        />
      </div>
    </div>
  );
}
