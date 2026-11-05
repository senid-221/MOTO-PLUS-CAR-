'use client';

/**
 * Sign-in step one: ask for the number, let the API send the code.
 *
 * The number is validated with the same shared schema the API uses, so the
 * E.164 normalisation happens before the call rather than as a surprise after
 * it. The purpose the API answered with is carried to the confirm step: a
 * number whose phone was never confirmed gets a REGISTER code even though the
 * visitor pressed Log in, and guessing that here would reject a valid code.
 */
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Language, SendOtpOutput } from '@seremoto/shared-types';
import { loginSchema } from '@seremoto/validation';
import { makeTranslator } from '@/messages';
import { ApiFailure, api } from '@/lib/api';
import { describeFailure, describeZodError, fieldErrors } from '@/lib/errors';
import { rememberDevOtp } from '@/lib/dev-otp';
import { PhoneField } from './PhoneField';
import { StatusMessage } from './StatusMessage';

export function LoginForm({ language }: { language: Language }) {
  const t = makeTranslator(language);
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    setError('');
    setPhoneError('');
    const parsed = loginSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(describeZodError(parsed.error, t));
      setPhoneError(fieldErrors(parsed.error, t).phone ?? '');
      return;
    }

    setPending(true);
    try {
      const result = await api.post<SendOtpOutput>('auth/login', { phone: parsed.data.phone });
      rememberDevOtp(result.phone, result.devOtpCode);
      const params = new URLSearchParams({
        phone: result.phone,
        purpose: result.purpose,
        minutes: String(Math.max(1, Math.round(result.expiresInSeconds / 60))),
      });
      router.push(`/verify?${params.toString()}`);
    } catch (failure) {
      setError(
        failure instanceof ApiFailure && failure.code === 'NOT_FOUND'
          ? t('error.no_account')
          : describeFailure(failure, t),
      );
      setPhoneError(fieldErrors(failure, t).phone ?? '');
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <PhoneField
          id="login-phone"
          label={t('auth.field.phone')}
          hint={t('auth.field.phone.hint')}
          error={phoneError}
          value={phone}
          onChange={(value) => {
            setPhone(value);
            if (phoneError) setPhoneError('');
          }}
          disabled={pending}
          autoComplete="tel"
        />

        <StatusMessage tone="error" message={error} />

        <div className="form-actions">
          <button className="btn btn--primary" type="submit" disabled={pending}>
            {pending ? t('auth.sending_code') : t('auth.login.submit')}
          </button>
        </div>
      </form>

      <div className="form-links">
        <Link href="/register">{t('auth.link.register')}</Link>
      </div>
    </>
  );
}
