'use client';

import { useEffect, useState } from 'react';

type MeResponse =
  | { ok: true; user: { sub: string; email: string; name?: string; googleSub?: string } }
  | { ok?: boolean; user?: unknown };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// temporary widget for testing auth flow
export function AuthWidget() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMe() {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/v1/auth/me`, {
        credentials: 'include',
      });
      const data = await res.json();
      setMe(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load session');
    }
  }

  async function logout() {
    setError(null);
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    setMe(null);
  }

  useEffect(() => {
    // Try to detect existing session on page load
    loadMe();
  }, []);

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <a href={`${API_URL}/v1/auth/google/start`}>Sign in with Google</a>

      <button type="button" onClick={loadMe}>
        Who am I?
      </button>

      <button type="button" onClick={logout}>
        Logout
      </button>

      {me?.user && typeof me.user === 'object' ? (
        <span style={{ fontSize: 12 }}>{(me as any).user?.email ?? 'signed in'}</span>
      ) : null}

      {error ? <span style={{ color: 'crimson', fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
