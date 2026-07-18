import { DEFAULT_BRANDING, getBranding } from '../index';
import { brandPostProcessor } from '../i18n-brand-post-processor';

// Guards the RE3 white-label invariants. If one of these fails after a
// RAGFlow upgrade, a customization was lost in the merge — see
// RE3_CUSTOMIZATIONS.md for how to re-apply it.
describe('RE3 branding defaults', () => {
  it('brands the product as RE3, not RAGFlow', () => {
    expect(DEFAULT_BRANDING.appName).toBe('RE3');
    expect(DEFAULT_BRANDING.pageTitle).toBe('RE3');
    expect(DEFAULT_BRANDING.i18nReplacements).toContainEqual([
      'RAGFlow',
      'RE3',
    ]);
  });

  it('restricts non-superuser navigation to home/chat/search', () => {
    expect(DEFAULT_BRANDING.userNavItems).toEqual(['home', 'chat', 'search']);
  });

  it('restricts non-superuser settings to team/profile', () => {
    expect(DEFAULT_BRANDING.userSettingItems).toEqual(['team', 'profile']);
  });

  it('serves defaults before branding.toml has loaded', () => {
    expect(getBranding()).toEqual(DEFAULT_BRANDING);
  });
});

describe('i18n brand post processor', () => {
  const process = (value: string) =>
    (brandPostProcessor.process as (v: string) => string)(value);

  it('rewrites every RAGFlow occurrence in translated strings', () => {
    expect(process('Welcome to RAGFlow! RAGFlow rocks.')).toBe(
      'Welcome to RE3! RE3 rocks.',
    );
  });

  it('leaves lowercase URLs untouched (case-sensitive)', () => {
    expect(process('see https://ragflow.io/docs')).toBe(
      'see https://ragflow.io/docs',
    );
  });
});
