/**
 * CivicConnect AI - Frontend Security Configuration.
 *
 * Implements strict gates against unauthorized client-side role switching:
 * 1. Demo role switcher is disabled by default in all environments.
 * 2. In production builds (PROD), demo role switching is UNCONDITIONALLY BLOCKED.
 * 3. In local development (DEV), it is ONLY active if explicitly opted-in via
 *    the environment variable: VITE_ENABLE_DEMO_ROLE_SWITCHER=true.
 * 4. Frontend environment variables and mock roles NEVER grant real backend permissions.
 */

export const isDemoRoleSwitcherEnabled = (): boolean => {
  // 1. Unconditionally forbid in production or non-dev builds
  if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
    return false;
  }

  // 2. Must be actively running in development server mode
  if (!import.meta.env.DEV) {
    return false;
  }

  // 3. Must be explicitly set to 'true' (default is false)
  return import.meta.env.VITE_ENABLE_DEMO_ROLE_SWITCHER === 'true';
};

