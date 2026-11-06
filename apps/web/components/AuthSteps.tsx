import type { Language } from '@seremoto/shared-types';
import { makeTranslator, type TranslationKey } from '@/messages';
import { CheckIcon } from './Icons';

/**
 * Where the visitor is inside sign-in: number, then code, then the account.
 *
 * The three screens are separate routes and each one already says what it wants,
 * which makes them feel like three unrelated forms. This strip is the missing
 * context — it is presentational only, computed from the route the server is
 * rendering, so it can never claim a step the API has not accepted.
 */
const STEPS: readonly TranslationKey[] = ['auth.step.phone', 'auth.step.code', 'auth.step.account'];

export type AuthStep = 1 | 2 | 3;

export function AuthSteps({ language, current }: { language: Language; current: AuthStep }) {
  const t = makeTranslator(language);

  return (
    <ol className="steps" aria-label={t('auth.steps.label')}>
      {STEPS.map((key, index) => {
        const number = index + 1;
        const done = number < current;
        return (
          <li
            key={key}
            className="step"
            data-done={done ? 'true' : undefined}
            aria-current={number === current ? 'step' : undefined}
          >
            <span className="step__dot">{done ? <CheckIcon size={15} /> : number}</span>
            <span className="step__label">{t(key)}</span>
          </li>
        );
      })}
    </ol>
  );
}
