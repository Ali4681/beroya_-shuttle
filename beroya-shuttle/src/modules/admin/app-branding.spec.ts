import { defaultBrandingPayload, normalizeBrandingPayload } from './app-branding';

describe('app-branding mapper', () => {
  it('fills defaults and nested public shape', () => {
    const payload = normalizeBrandingPayload({
      colors: { primary: '#aabbcc' },
      splash: { enabled: true, duration: 4000, animationType: 'gif' },
      appIcon: { android: 'icon_03' },
    });
    expect(payload.primaryColor).toBe('#AABBCC');
    expect(payload.secondaryColor).toBe(defaultBrandingPayload().secondaryColor);
    expect(payload.splashAnimationEnabled).toBe(true);
    expect(payload.splashDuration).toBe(4000);
    expect(payload.splashAnimationType).toBe('gif');
    expect(payload.selectedAndroidIcon).toBe('icon_03');
    expect(payload.selectedIosIcon).toBe('icon_01');
  });

  it('rejects unknown icons by falling back to icon_01', () => {
    const payload = normalizeBrandingPayload({
      selectedAndroidIcon: 'icon_99',
    });
    expect(payload.selectedAndroidIcon).toBe('icon_01');
  });
});
