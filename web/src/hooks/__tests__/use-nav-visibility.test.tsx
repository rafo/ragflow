import { renderHook } from '@testing-library/react';
import { useNavItemVisibility } from '../use-nav-visibility';

const mockUseFetchUserInfo = jest.fn();

jest.mock('@/branding', () => ({
  getBranding: () => ({
    fullAccessEmails: ['Owner@Example.com'],
    userNavItems: ['home', 'chat', 'search'],
    userSettingItems: ['team', 'profile'],
  }),
}));

jest.mock('@/hooks/use-user-setting-request', () => ({
  useFetchUserInfo: () => mockUseFetchUserInfo(),
}));

// Guards the RE3 role-based menu whitelist. If this fails after a RAGFlow
// upgrade, the visibility hook or its wiring was lost — see
// RE3_CUSTOMIZATIONS.md.
describe('useNavItemVisibility', () => {
  it('limits testers to the branding.toml whitelists', () => {
    // is_superuser is ignored: v1.0 superusers cannot use the app at all
    mockUseFetchUserInfo.mockReturnValue({
      data: { email: 'tester@example.com', is_superuser: true },
    });
    const { result } = renderHook(() => useNavItemVisibility());

    expect(result.current.hasFullAccess).toBe(false);
    expect(result.current.isNavItemVisible('chat')).toBe(true);
    expect(result.current.isNavItemVisible('search')).toBe(true);
    expect(result.current.isNavItemVisible('datasets')).toBe(false);
    expect(result.current.isNavItemVisible('agent')).toBe(false);
    expect(result.current.isNavItemVisible('memory')).toBe(false);
    expect(result.current.isNavItemVisible('files')).toBe(false);

    expect(result.current.isSettingItemVisible('team')).toBe(true);
    expect(result.current.isSettingItemVisible('profile')).toBe(true);
    expect(result.current.isSettingItemVisible('api')).toBe(false);
    expect(result.current.isSettingItemVisible('model-providers')).toBe(false);
  });

  it('treats a user with unloaded info as restricted (no flash of admin UI)', () => {
    mockUseFetchUserInfo.mockReturnValue({ data: {} });
    const { result } = renderHook(() => useNavItemVisibility());

    expect(result.current.hasFullAccess).toBe(false);
    expect(result.current.isNavItemVisible('datasets')).toBe(false);
  });

  it('shows fullAccessEmails accounts everything (case-insensitive)', () => {
    mockUseFetchUserInfo.mockReturnValue({
      data: { email: 'owner@example.com' },
    });
    const { result } = renderHook(() => useNavItemVisibility());

    expect(result.current.hasFullAccess).toBe(true);
    expect(result.current.isNavItemVisible('datasets')).toBe(true);
    expect(result.current.isSettingItemVisible('api')).toBe(true);
  });
});
