import type { Language } from '@seremoto/shared-types';
import { makeTranslator } from '@/messages';

export function SiteFooter({ language }: { language: Language }) {
  const t = makeTranslator(language);

  return (
    <footer className="site-footer">
      <div className="container site-footer__row">
        <p>
          {t('brand.name')} — {t('brand.tagline')}
        </p>
        <p>{t('footer.location')}</p>
      </div>
    </footer>
  );
}
