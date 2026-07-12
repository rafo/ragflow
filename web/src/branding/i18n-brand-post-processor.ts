import type { PostProcessorModule } from 'i18next';
import { getBranding } from './index';

// Rewrites brand names in every translated string at t() time, so the 16
// upstream locale files stay untouched (rebase-friendly). Replacements are
// case-sensitive: "RAGFlow" is rewritten, "ragflow.io" URLs are not.
export const brandPostProcessor: PostProcessorModule = {
  type: 'postProcessor',
  name: 'brand',
  process(value: string): string {
    let out = value;
    for (const [from, to] of getBranding().i18nReplacements ?? []) {
      out = out.split(from).join(to);
    }
    return out;
  },
};
