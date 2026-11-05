'use client';

/**
 * The account screen. Everything on it is read from the API for the signed-in
 * account: the identity summary comes from /auth/me, the session list from
 * /auth/sessions, and each action is a real call. Nothing is prefilled from a
 * fixture and no numbers are invented.
 *
 * Controls appear or hide according to the permissions the backend actually
 * granted, so a change of role shows up here without a code edit. The server
 * checks the same permissions on every request; this only avoids offering an
 * action that would be refused.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CurrentUserSummary, Language, SessionDeviceInfo } from '@seremoto/shared-types';
import { formatDate, formatDateTime } from '@seremoto/localization';
import { makeTranslator } from '@/messages';
import { api } from '@/lib/api';
import { describeFailure } from '@/lib/errors';
import { formatPhone, roleLabel } from '@/lib/labels';
import { StatusMessage } from './StatusMessage';

export function AccountPanel({ language }: { language: Language }) {
  const t = useMemo(() => makeTranslator(language), [language]);
  const router = useRouter();

  const [user, setUser] = useState<CurrentUserSummary | null>(null);
  const [sessions, setSessions] = useState<SessionDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preferred, setPreferred] = useState<Language>(language);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const me = await api.get<CurrentUserSummary>('auth/me');
      setUser(me);
      setPreferred(me.preferredLanguage === 'en' ? 'en' : 'rw');
      setSessions(
        me.permissions.includes('session:manage')
          ? await api.get<SessionDeviceInfo[]>('auth/sessions')
          : [],
      );
    } catch (failure) {
      setUser(null);
      setError(describeFailure(failure, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLanguage(): Promise<void> {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      setUser(
        await api.patch<CurrentUserSummary>('users/profile', { preferredLanguage: preferred }),
      );
      setNotice(t('state.success.saved'));
    } catch (failure) {
      setError(describeFailure(failure, t));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(sessionId: string): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await api.post(`auth/sessions/${sessionId}/revoke`);
      setSessions(await api.get<SessionDeviceInfo[]>('auth/sessions'));
    } catch (failure) {
      setError(describeFailure(failure, t));
    } finally {
      setBusy(false);
    }
  }

  async function signOut(): Promise<void> {
    setBusy(true);
    try {
      await api.post('auth/logout');
    } catch (failure) {
      setError(describeFailure(failure, t));
    } finally {
      setBusy(false);
      setConfirmSignOut(false);
      // The proxy clears both session cookies on the way out, signed or not.
      router.replace('/login');
      router.refresh();
    }
  }

  if (loading) {
    return (
      <p aria-live="polite">
        <span className="pill">{t('common.loading')}</span>
      </p>
    );
  }

  if (!user) {
    return (
      <>
        <StatusMessage tone="error" message={error || t('auth.session.expired')} />
        <div className="form-actions">
          <Link className="btn btn--primary" href="/login">
            {t('nav.login')}
          </Link>
        </div>
      </>
    );
  }

  const canUpdateProfile = user.permissions.includes('account:update');
  const canManageSessions = user.permissions.includes('session:manage');

  return (
    <>
      <p className="note--lead">
        {t('auth.signed_in_as')} {user.fullName}
      </p>

      <StatusMessage tone="error" message={error} />
      <StatusMessage tone="success" message={notice} />

      <ul className="data-list">
        <li>
          <span className="row__label">{t('auth.field.phone')}</span>
          <span className="row__value">{formatPhone(user.phone)}</span>
        </li>
        <li>
          <span className="row__label">{t('auth.phone_verified')}</span>
          <span className={`pill ${user.phoneVerified ? 'pill--ok' : 'pill--warn'}`}>
            {user.phoneVerified ? t('common.yes') : t('common.no')}
          </span>
        </li>
        {user.email ? (
          <li>
            <span className="row__label">{t('auth.field.email')}</span>
            <span className="row__value">{user.email}</span>
          </li>
        ) : null}
        <li>
          <span className="row__label">{t('auth.roles_label')}</span>
          <span className="row__value">
            {user.roles.map((role) => roleLabel(role, t)).join(', ')}
          </span>
        </li>
      </ul>

      <details className="disclosure">
        <summary>
          {t('auth.permissions_label')} ({user.permissions.length})
        </summary>
        <ul className="permission-list">
          {user.permissions.map((permission) => (
            <li key={permission}>
              <code>{permission}</code>
            </li>
          ))}
        </ul>
      </details>

      {canUpdateProfile ? (
        <div className="card card--section">
          <h2>{t('auth.field.language')}</h2>
          <p className="note--lead">{t('auth.profile.language_hint')}</p>
          <div className="form-actions">
            <select
              className="select--narrow"
              aria-label={t('nav.language')}
              value={preferred}
              onChange={(event) => setPreferred(event.target.value === 'en' ? 'en' : 'rw')}
              disabled={busy}
            >
              <option value="rw">{t('language.rw')}</option>
              <option value="en">{t('language.en')}</option>
            </select>
            <button
              className="btn btn--secondary"
              type="button"
              onClick={() => void saveLanguage()}
              disabled={busy || preferred === user.preferredLanguage}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      ) : null}

      {canManageSessions ? (
        <div className="card card--section">
          <h2>{t('auth.sessions.title')}</h2>
          {sessions.length === 0 ? (
            <p className="note--lead">{t('state.empty.title')}</p>
          ) : (
            <ul className="data-list">
              {sessions.map((session) => (
                <li key={session.sessionId}>
                  <span>
                    <span className="row__value">
                      {session.deviceLabel ?? t('auth.session.unknown_device')}
                    </span>
                    <br />
                    <span className="row__label">
                      {formatDateTime(session.lastUsedAt, language)} ·{' '}
                      {formatDate(session.expiresAt, language)}
                    </span>
                  </span>
                  {session.current ? (
                    <span className="pill pill--ok">{t('auth.session.current')}</span>
                  ) : (
                    <button
                      className="btn btn--danger btn--small"
                      type="button"
                      disabled={busy}
                      onClick={() => void revoke(session.sessionId)}
                    >
                      {t('auth.sessions.revoke')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="form-actions">
        {confirmSignOut ? (
          <>
            <span>{t('auth.logout.confirm')}</span>
            <button
              className="btn btn--danger"
              type="button"
              onClick={() => void signOut()}
              disabled={busy}
            >
              {t('common.confirm')}
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setConfirmSignOut(false)}
            >
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <button
            className="btn btn--secondary"
            type="button"
            onClick={() => setConfirmSignOut(true)}
          >
            {t('nav.logout')}
          </button>
        )}
      </div>
    </>
  );
}
