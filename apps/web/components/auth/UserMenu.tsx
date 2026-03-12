'use client';

import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { API_URL } from '@/lib/api/client';
import { LogOutIcon, UserIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function UserMenu() {
  const state = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (state.status === 'loading') {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />;
  }

  if (state.status === 'unauthenticated') {
    return (
      <a
        href={`${API_URL}/v1/auth/google/start`}
        className="rounded-full border border-[#0B57D0] px-3 py-1.5 text-sm font-medium text-[#0B57D0] hover:bg-blue-50"
      >
        Sign in
      </a>
    );
  }

  const { user } = state;
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (user.email[0]?.toUpperCase() ?? '?');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B57D0] text-sm font-semibold text-white hover:opacity-90 focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        title={user.name ?? user.email}
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture}
            alt={user.name ?? user.email}
            className="h-8 w-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open && (
        <div className="absolute top-10 right-0 z-50 w-64 rounded-2xl border border-gray-200 bg-white py-2 shadow-xl">
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B57D0] text-sm font-semibold text-white">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt={user.name ?? user.email}
                  className="h-10 w-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon size={18} />
              )}
            </div>
            <div className="min-w-0">
              {user.name && (
                <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
              )}
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="my-1 border-t border-gray-100" />

          {/* Logout */}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={async () => {
              await fetch(`${API_URL}/v1/auth/logout`, {
                method: 'POST',
                credentials: 'include',
              });
              window.location.href = '/login';
            }}
          >
            <LogOutIcon size={15} className="text-gray-400" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
