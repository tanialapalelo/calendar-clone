'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api/client';

export type CurrentUser = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

type State =
  | { status: 'loading' }
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'unauthenticated' };

export function useCurrentUser(): State {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/v1/auth/me`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('unauthenticated');
        return res.json() as Promise<{ ok: boolean; user: CurrentUser }>;
      })
      .then((data) => {
        if (!cancelled && data.ok && data.user) {
          setState({ status: 'authenticated', user: data.user });
        } else if (!cancelled) {
          setState({ status: 'unauthenticated' });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unauthenticated' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
