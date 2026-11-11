import {
  noticeForLocale,
  packNotice,
  PLATFORM_DEFAULTS,
} from './platform-settings';

describe('packNotice / noticeForLocale', () => {
  it('stores Arabic as the default title/body without mixing English', () => {
    const notice = packNotice(PLATFORM_DEFAULTS.templates.arrivalSoon, {
      minutes: 5,
      studentName: 'أحمد',
    });
    expect(notice.title).toBe('الحافلة تقترب');
    expect(notice.body).toContain('أحمد');
    expect(notice.body).not.toContain('Bus is approaching');
    expect(notice.i18n.titleEn).toBe('Bus is approaching');
    expect(notice.i18n.bodyEn).toContain('أحمد');
  });

  it('resolves English from stored i18n for English devices', () => {
    const notice = packNotice(PLATFORM_DEFAULTS.templates.delay, {
      minutes: 12,
    });
    const en = noticeForLocale(notice.title, notice.body, { i18n: notice.i18n }, 'en');
    expect(en.title).toBe('Trip delayed');
    expect(en.body).toContain('12');
    expect(en.body).not.toContain('متأخرة');
  });

  it('falls back to Arabic when locale is missing or unsupported', () => {
    const notice = packNotice(PLATFORM_DEFAULTS.templates.emergency);
    const ar = noticeForLocale(notice.title, notice.body, { i18n: notice.i18n }, 'fr');
    expect(ar.title).toBe('طوارئ في رحلة');
    expect(ar.body).toBe('تم الضغط على زر الطوارئ.');
  });
});
