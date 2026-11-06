'use client';

/**
 * Sign-in step two: confirm the code.
 *
 * A successful call answers with the session, and the proxy has already moved
 * the access token into an httpOnly cookie and written the rotating refresh
 * cookie, so this component never sees either value. It only learns who signed
 * in. The purpose travels from the previous step because a code issued for an
 * unverified phone is a REGISTER code, not a LOGIN one.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AuthSession, Language, OtpPurposeName, SendOtpOutput } from '@seremoto/shared-types';
import { verifyOtpSchema } from '@seremoto/validation';
import { makeTranslator } from '@/messages';
import { api } from '@/lib/api';
import { describeFailure, describeZodError, fieldErrors } from '@/lib/errors';
import { forgetDevOtp, readDevOtp, rememberDevOtp } from '@/lib/dev-otp';
import { formatPhone } from '@/lib/labels';
import { OtpField } from './OtpField';
import { StatusMessage } from './StatusMessage';
import { CheckIcon, RetryIcon, SpinnerIcon } from './Icons';

export function VerifyForm({
  phone,
  purpose,
  minutes,
  language,
}: {
  phone: string;
  purpose: OtpPurposeName;
  minutes: number;
  language: Language;
}) {
  const t = makeTranslator(language);
  const router = useRouter();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    setDevCode(readDevOtp(phone));
  }, [phone]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    setError('');
    setNotice('');
    setCodeError('');
    const parsed = verifyOtpSchema.safeParse({ phone, code, purpose });
    if (!parsed.success) {
      setError(describeZodError(parsed.error, t));
      setCodeError(fieldErrors(parsed.error, t).code ?? '');
      return;
    }

    setPending(true);
    try {
      // The proxy strips the access token from this payload before it arrives.
      await api.post<AuthSession>('auth/verify-otp', parsed.data);
      forgetDevOtp();
      setDevCode(null);
      // The session cookies are set by the proxy, so the shell can be re-read.
      router.replace('/account');
      router.refresh();
    } catch (failure) {
      setError(describeFailure(failure, t));
      setPending(false);
    }
  }

  async function resend(): Promise<void> {
    if (resending || pending) return;
    setResending(true);
    setError('');
    try {
      const result = await api.post<SendOtpOutput>('auth/send-otp', { phone, purpose });
      rememberDevOtp(result.phone, result.devOtpCode);
      setDevCode(readDevOtp(result.phone));
      setNotice(
        t('auth.otp.subtitle', {
          phone: formatPhone(result.phone),
          minutes: Math.max(1, Math.round(result.expiresInSeconds / 60)),
        }),
      );
      setCode('');
    } catch (failure) {
      setError(describeFailure(failure, t));
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <p>{t('auth.otp.subtitle', { phone: formatPhone(phone), minutes })}</p>

      {devCode ? (
        <StatusMessage tone="info" message={t('auth.otp.dev_code', { code: devCode })} />
      ) : null}
      <StatusMessage tone="info" message={notice} />
      <StatusMessage tone="error" message={error} />

      <form onSubmit={(event) => void submit(event)} noValidate>
        <OtpField
          id="verify-code"
          label={t('auth.otp.title')}
          error={codeError}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (codeError) setCodeError('');
          }}
          disabled={pending}
        />

        <div className="form-actions">
          <button
            className="btn btn--primary"
            type="submit"
            disabled={pending || code.length !== 6}
          >
            {pending ? (
              <SpinnerIcon size={18} className="btn-spin" aria-hidden />
            ) : (
              <CheckIcon size={18} aria-hidden />
            )}
            {pending ? t('auth.verifying') : t('auth.otp.verify')}
          </button>
          <button
            className="btn btn--secondary btn--small"
            type="button"
            onClick={() => void resend()}
            disabled={resending || pending}
          >
            {resending ? (
              <SpinnerIcon size={16} className="btn-spin" aria-hidden />
            ) : (
              <RetryIcon size={16} aria-hidden />
            )}
            {resending ? t('auth.sending_code') : t('auth.otp.resend')}
          </button>
        </div>
      </form>

      <div className="form-links">
        <Link href="/login">{t('auth.login.title')}</Link>
      </div>
    </>
  );
}
