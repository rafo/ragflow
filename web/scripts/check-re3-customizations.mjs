#!/usr/bin/env node
// Verifies that every RE3 customization is still anchored in the source.
// Run after a RAGFlow upgrade (and in CI before the image build):
//   cd web && npm run check:re3
// A failure means an upstream refactor removed or moved one of our touch
// points — see RE3_CUSTOMIZATIONS.md for what the anchor does and how to
// re-apply it.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// file (relative to web/) → required substrings → what the anchor does
const anchors = [
  {
    file: 'src/branding/index.ts',
    needles: ['getBranding', 'loadBranding', 'userNavItems', 'userSettingItems'],
    purpose: 'central branding module (options file, role whitelists)',
  },
  {
    file: 'src/branding/i18n-brand-post-processor.ts',
    needles: ['brandPostProcessor'],
    purpose: 'rewrites RAGFlow→appName in all UI languages',
  },
  {
    file: 'src/main.tsx',
    needles: ['loadBranding'],
    purpose: 'branding.toml must load before React renders',
  },
  {
    file: 'src/locales/config.ts',
    needles: ['brandPostProcessor'],
    purpose: 'post processor must be registered with i18next',
  },
  {
    file: 'index.html',
    needles: ['branding'],
    purpose: 'favicon/title bootstrap from branding',
  },
  {
    file: 'src/hooks/use-nav-visibility.ts',
    needles: ['isNavItemVisible', 'isSettingItemVisible'],
    purpose: 'role-based menu whitelist hook',
  },
  {
    file: 'src/layouts/components/global-navbar.tsx',
    needles: ['useVisibleMenuItems', 'getBranding'],
    purpose: 'navbar filtered for non-superusers, logo from branding',
  },
  {
    file: 'src/pages/home/index.tsx',
    needles: ['isNavItemVisible', 'PrototypeHome'],
    purpose: 'home page: prototype home for testers, gated sections otherwise',
  },
  {
    file: 'src/pages/home/prototype-home.tsx',
    needles: ['/branding/home.md'],
    purpose: 'tester home rendered from mountable markdown',
  },
  {
    file: 'public/branding/home.md',
    needles: ['Research Preview'],
    purpose: 'baked-in default tester home content',
  },
  {
    file: 'src/pages/home/applications.tsx',
    needles: ['isNavItemVisible'],
    purpose: 'home app tabs (chat/search/agent/memory) gated',
  },
  {
    file: 'src/pages/user-setting/sidebar/index.tsx',
    needles: ['isSettingItemVisible'],
    purpose: 'settings sidebar filtered for non-superusers',
  },
  {
    file: 'src/pages/user-setting/setting-team/index.tsx',
    needles: ['isSuperuser'],
    purpose: 'team "Invite member" button hidden for non-superusers',
  },
  {
    file: 'src/pages/login-next/index.tsx',
    needles: ['getBranding'],
    purpose: 'login page logo/app name from branding',
  },
  {
    file: 'src/routes.tsx',
    needles: ['Navigate to="/user-setting/profile"'],
    purpose: 'settings default route is Profile, not Data sources',
  },
  {
    file: 'public/branding.toml',
    needles: ['appName', 'userNavItems', 'userSettingItems'],
    purpose: 'baked-in default branding options',
  },
];

// Regressions: patterns that must NOT (re)appear unconditionally.
const forbidden = [
  {
    file: 'src/layouts/components/header.tsx',
    pattern: /discord\.com|infiniflow\/ragflow/,
    unless: /getBranding|brand\.links/,
    purpose: 'header Discord/GitHub links must be branding-conditional',
  },
];

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`✗ ${msg}`);
};

for (const { file, needles, purpose } of anchors) {
  const path = join(webRoot, file);
  if (!existsSync(path)) {
    fail(`${file} missing — ${purpose}`);
    continue;
  }
  const content = readFileSync(path, 'utf8');
  for (const needle of needles) {
    if (!content.includes(needle)) {
      fail(`${file}: "${needle}" not found — ${purpose}`);
    }
  }
}

for (const { file, pattern, unless, purpose } of forbidden) {
  const path = join(webRoot, file);
  if (!existsSync(path)) continue; // upstream may rename; anchors cover the rest
  const content = readFileSync(path, 'utf8');
  if (pattern.test(content) && !unless.test(content)) {
    fail(`${file}: matches ${pattern} without ${unless} — ${purpose}`);
  }
}

if (failures) {
  console.error(
    `\n${failures} RE3 customization anchor(s) broken. See RE3_CUSTOMIZATIONS.md.`,
  );
  process.exit(1);
}
console.log(`✓ all ${anchors.length} RE3 customization anchors intact`);
