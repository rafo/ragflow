import { parse } from 'smol-toml';

export interface BrandingLinks {
  help?: string;
  discord?: string;
  github?: string;
}

export interface Branding {
  appName: string;
  pageTitle: string;
  faviconUrl: string;
  logoUrl: string;
  links: BrandingLinks;
  i18nReplacements: Array<[string, string]>;
  colors: Record<string, string>;
}

export const DEFAULT_BRANDING: Branding = {
  appName: 'RE3',
  pageTitle: 'RE3',
  faviconUrl: '/branding/logo.png',
  logoUrl: '/branding/logo.png',
  links: {},
  i18nReplacements: [['RAGFlow', 'RE3']],
  colors: {},
};

let branding: Branding = DEFAULT_BRANDING;

export function getBranding(): Branding {
  return branding;
}

// Plain fetch on purpose: /branding.toml is a static file, not an API call,
// and must load before login (no auth/401 handling wanted).
export async function loadBranding(): Promise<Branding> {
  try {
    const res = await fetch('/branding.toml', { cache: 'no-cache' });
    if (res.ok) {
      const parsed = parse(await res.text()) as Partial<Branding>;
      branding = { ...DEFAULT_BRANDING, ...parsed };
    }
  } catch (e) {
    console.warn('branding.toml could not be loaded, using defaults:', e);
  }
  applyBranding(branding);
  return branding;
}

function applyBranding(b: Branding) {
  document.title = b.pageTitle;
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon && b.faviconUrl) {
    icon.href = b.faviconUrl;
  }
  for (const [key, value] of Object.entries(b.colors ?? {})) {
    document.documentElement.style.setProperty(key, value);
  }
}
