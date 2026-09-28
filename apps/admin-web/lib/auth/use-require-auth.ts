'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

interface UseRequireAuthOptions {
  redirectTo?: string;
}

/**
 * Hook that redirects to /login if the user is not authenticated.
 * Use inside dashboard-level components.
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}): void {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const redirectTo = options.redirectTo ?? '/login';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);
}
