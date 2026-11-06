'use client';

/**
 * Sign-up. Name, number, and what the visitor wants to do.
 *
 * Only self-assignable roles are offered: rider, merchant, garage, cooperative
 * and business accounts still need verification or an administrator before they
 * gain anything, and the schema refuses a staff role here. The account stays
 * PENDING until the code on the next screen proves the phone belongs to them.
 */
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { RegisterOutput, Language, UserRole } from '@seremoto/shared-types';
import { SELF_ASSIGNABLE_ROLES } from '@seremoto/shared-types';
import { registerSchema } from '@seremoto/validation';
import { makeTranslator } from '@/messages';
import { ApiFailure, api } from '@/lib/api';
import { describeFailure, describeZodError, fieldErrors } from '@/lib/errors';
import { roleLabel } from '@/lib/labels';
import { rememberDevOtp } from '@/lib/dev-otp';
import { PhoneField } from './PhoneField';
import { StatusMessage } from './StatusMessage';
import { RegisterIcon, SpinnerIcon } from './Icons';

export function RegisterForm({ language }: { language: Language }) {
  const t = makeTranslator(language);
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState<UserRole[]>(['CUSTOMER']);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  function toggleRole(role: UserRole): void {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((entry) => entry !== role)
        : [...current, role].slice(0, 4),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    setError('');
    setFieldErr({});
    const parsed = registerSchema.safeParse({
      fullName,
      phone,
      preferredLanguage: language,
      roles: roles.length > 0 ? roles : ['CUSTOMER'],
    });
    if (!parsed.success) {
      setError(describeZodError(parsed.error, t));
      setFieldErr(fieldErrors(parsed.error, t));
      return;
    }

    setPending(true);
    try {
      const result = await api.post<RegisterOutput>('auth/register', parsed.data);
      rememberDevOtp(result.phone, result.devOtpCode);
      const params = new URLSearchParams({
        phone: result.phone,
        purpose: result.purpose,
        minutes: String(Math.max(1, Math.round(result.expiresInSeconds / 60))),
      });
      router.push(`/verify?${params.toString()}`);
    } catch (failure) {
      setError(
        failure instanceof ApiFailure && failure.code === 'CONFLICT'
          ? t('error.phone_taken')
          : describeFailure(failure, t),
      );
      setFieldErr(fieldErrors(failure, t));
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="register-name">
            {t('auth.field.name')}
          </label>
          <input
            id="register-name"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setFieldErr((current) => ({ ...current, fullName: '' }));
            }}
            aria-invalid={fieldErr.fullName ? true : undefined}
            aria-describedby={fieldErr.fullName ? 'register-name-error' : undefined}
            disabled={pending}
            required
          />
          {fieldErr.fullName ? (
            <span className="field__error" id="register-name-error">
              {fieldErr.fullName}
            </span>
          ) : (
            <span className="field__hint">{t('auth.field.name.hint')}</span>
          )}
        </div>

        <PhoneField
          id="register-phone"
          label={t('auth.field.phone')}
          hint={t('auth.field.phone.hint')}
          error={fieldErr.phone}
          value={phone}
          onChange={(value) => {
            setPhone(value);
            setFieldErr((current) => ({ ...current, phone: '' }));
          }}
          disabled={pending}
        />

        <fieldset className="fieldset">
          <legend className="field__label">{t('auth.roles')}</legend>
          <ul className="choice-list">
            {SELF_ASSIGNABLE_ROLES.map((role) => (
              <li key={role}>
                <label className="choice">
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    disabled={pending}
                  />
                  {roleLabel(role, t)}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <StatusMessage tone="error" message={error} />

        <div className="form-actions">
          <button className="btn btn--primary" type="submit" disabled={pending}>
            {pending ? (
              <SpinnerIcon size={18} className="btn-spin" aria-hidden />
            ) : (
              <RegisterIcon size={18} aria-hidden />
            )}
            {pending ? t('auth.sending_code') : t('auth.send_code')}
          </button>
        </div>
      </form>

      <p className="card__note">{t('auth.register.subtitle')}</p>

      <div className="form-links">
        <Link href="/login">{t('auth.link.login')}</Link>
      </div>
    </>
  );
}
