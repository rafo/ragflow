import { getBranding } from '@/branding';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

function FooterDivider() {
  return <span className="text-border-button select-none">|</span>;
}

function FooterLink({
  children,
  onClick,
  href,
  target,
  rel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href: string;
  target?: string;
  rel?: string;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      onClick={onClick}
      className="text-text-secondary transition-colors hover:text-text-primary"
    >
      {children}
    </a>
  );
}

type MobileMenuFooterProps = {
  onClose: () => void;
};

export function MobileMenuFooter({ onClose }: MobileMenuFooterProps) {
  const { t } = useTranslation();

  const { links } = getBranding();
  const footerLinks = [
    { key: 'discord', href: links.discord, label: t('header.discord') },
    { key: 'github', href: links.github, label: t('header.github') },
    { key: 'help', href: links.help, label: t('header.help') },
  ].filter((x): x is typeof x & { href: string } => Boolean(x.href));

  if (footerLinks.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-border-button px-4 py-4">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        {footerLinks.map((link, index) => (
          <Fragment key={link.key}>
            {index > 0 && <FooterDivider />}
            <FooterLink
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              onClick={onClose}
            >
              {link.label}
            </FooterLink>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
