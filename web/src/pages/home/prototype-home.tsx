import { PageContainer } from '@/layouts/components/page-container';
import { useQuery } from '@tanstack/react-query';
import Markdown from 'react-markdown';
// GFM only (tables); deliberately no remark-breaks — home.md is
// hard-wrapped prose and single newlines must not become <br>.
import remarkGfm from 'remark-gfm';

const PrototypeHomeKeys = {
  content: ['prototypeHomeContent'] as const,
};

// Plain fetch on purpose (like /branding.toml): /branding/home.md is a
// static, deployment-mountable file, not an API call.
export function usePrototypeHomeContent(enabled: boolean) {
  const { data } = useQuery({
    queryKey: PrototypeHomeKeys.content,
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch('/branding/home.md', { cache: 'no-cache' });
      if (!res.ok) {
        return '';
      }
      const text = await res.text();
      // A misconfigured server may answer 200 with the SPA index.html.
      return text.trimStart().startsWith('<') ? '' : text;
    },
  });

  return { content: data ?? '' };
}

// Replaces the upstream home page for non-superusers: prototype status,
// usage help, and feedback channel, driven by the mountable markdown file
// docker/branding/assets/home.md (no rebuild needed for content edits).
export function PrototypeHome({ content }: { content: string }) {
  return (
    <PageContainer>
      <article className="mx-auto max-w-3xl px-4 py-10 text-text-primary">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-3xl font-semibold mb-6">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xl font-semibold mt-10 mb-3">{children}</h2>
            ),
            p: ({ children }) => (
              <p className="my-3 leading-relaxed text-text-secondary">
                {children}
              </p>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-6 rounded-lg border border-accent-primary/40 bg-bg-card px-5 py-3 [&_p]:text-text-primary">
                {children}
              </blockquote>
            ),
            ul: ({ children }) => (
              <ul className="my-3 list-disc pl-6 space-y-1.5 text-text-secondary">
                {children}
              </ul>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-accent-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto">
                <table className="w-full text-left border-collapse [&_th]:border-b [&_th]:border-border-default [&_th]:py-2 [&_th]:pr-4 [&_td]:py-2 [&_td]:pr-4 [&_td]:text-text-secondary">
                  {children}
                </table>
              </div>
            ),
            hr: () => <hr className="my-8 border-border-default" />,
            strong: ({ children }) => (
              <strong className="font-semibold text-text-primary">
                {children}
              </strong>
            ),
          }}
        >
          {content}
        </Markdown>
      </article>
    </PageContainer>
  );
}
