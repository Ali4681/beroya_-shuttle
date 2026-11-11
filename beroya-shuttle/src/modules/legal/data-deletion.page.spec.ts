import {
  DATA_DELETION_SUPPORT_EMAIL,
  renderDataDeletionPage,
} from './data-deletion.page';

describe('renderDataDeletionPage', () => {
  it('returns Arabic HTML by default locale', () => {
    const html = renderDataDeletionPage('ar');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('طلب حذف الحساب / البيانات');
    expect(html).toContain(DATA_DELETION_SUPPORT_EMAIL);
    expect(html).toContain('mailto:');
    expect(html).toContain('/api/v1/shuttle/public/legal/privacy-policy');
    expect(html).toContain('30');
  });

  it('returns English HTML when locale is en', () => {
    const html = renderDataDeletionPage('en');
    expect(html).toContain('lang="en"');
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('Request account / data deletion');
    expect(html).toContain('Delete account');
    expect(html).toContain(DATA_DELETION_SUPPORT_EMAIL);
  });
});
