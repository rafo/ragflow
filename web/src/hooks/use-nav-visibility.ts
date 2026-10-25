import { getBranding } from '@/branding';
import { useFetchUserInfo } from '@/hooks/use-user-setting-request';
import { useCallback } from 'react';

// Users listed in branding.toml (fullAccessEmails) see the full UI; everyone
// else gets the userNavItems/userSettingItems whitelists. Not is_superuser:
// since v1.0 superusers are admin-panel-only and cannot use the app at all.
export function useNavItemVisibility() {
  const { data: userInfo } = useFetchUserInfo();
  const email = userInfo?.email?.toLowerCase();
  const hasFullAccess =
    !!email &&
    (getBranding().fullAccessEmails ?? []).some(
      (e) => e.toLowerCase() === email,
    );

  const isNavItemVisible = useCallback(
    (id: string) =>
      hasFullAccess || (getBranding().userNavItems ?? []).includes(id),
    [hasFullAccess],
  );

  const isSettingItemVisible = useCallback(
    (id: string) =>
      hasFullAccess || (getBranding().userSettingItems ?? []).includes(id),
    [hasFullAccess],
  );

  return { hasFullAccess, isNavItemVisible, isSettingItemVisible };
}
