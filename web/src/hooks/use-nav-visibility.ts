import { getBranding } from '@/branding';
import { useFetchUserInfo } from '@/hooks/use-user-setting-request';
import { useCallback } from 'react';

// Whitelist from branding.toml (userNavItems) applied to non-superusers;
// superusers always see every nav entry and home section.
export function useNavItemVisibility() {
  const { data: userInfo } = useFetchUserInfo();
  const isSuperuser = !!userInfo?.is_superuser;

  const isNavItemVisible = useCallback(
    (id: string) =>
      isSuperuser || (getBranding().userNavItems ?? []).includes(id),
    [isSuperuser],
  );

  const isSettingItemVisible = useCallback(
    (id: string) =>
      isSuperuser || (getBranding().userSettingItems ?? []).includes(id),
    [isSuperuser],
  );

  return { isSuperuser, isNavItemVisible, isSettingItemVisible };
}
