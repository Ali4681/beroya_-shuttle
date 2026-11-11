import { Injectable } from '@nestjs/common';
import { AppLocale } from '../../common/i18n';
import { getRequestContext } from '../../common/request-context/request-context';
import { renderDataDeletionPage } from './data-deletion.page';
import {
  getLegalDocument,
  LegalDocumentKey,
  listLegalDocuments,
} from './legal.content';

@Injectable()
export class LegalService {
  list(locale?: AppLocale | string | null) {
    return {
      documents: listLegalDocuments(this.resolveLocale(locale)),
    };
  }

  get(key: LegalDocumentKey, locale?: AppLocale | string | null) {
    return getLegalDocument(key, this.resolveLocale(locale));
  }

  dataDeletionHtml(locale?: AppLocale | string | null) {
    return renderDataDeletionPage(this.resolveLocale(locale));
  }

  private resolveLocale(locale?: AppLocale | string | null): AppLocale {
    if (locale === 'ar' || locale === 'en') return locale;
    return getRequestContext()?.locale ?? 'ar';
  }
}
