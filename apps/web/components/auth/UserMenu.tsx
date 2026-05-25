'use client';

import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { API_URL } from '@/lib/api/client';
import { LogOutIcon, UserIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

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
        className="rounded-full border border-[#0B57D0] px-3 py-1.5 text-xs font-medium text-[#0B57D0] hover:bg-blue-50 sm:text-sm"
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
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B57D0] text-xs font-semibold text-white hover:opacity-90 focus:outline-none sm:h-8 sm:w-8 sm:text-sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        title={user.name ?? user.email}
      >
        {user.picture ? (
          <Image
            src={user.picture}
            alt={user.name ?? user.email}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open && (
        <div className="absolute top-10 right-0 z-50 w-64 rounded-2xl border border-gray-200 bg-white py-2 shadow-xl dark:bg-gray-700">
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B57D0] text-sm font-semibold text-white">
              {user.picture ? (
                <Image
                  src={user.picture}
                  alt={user.name ?? user.email}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon size={18} />
              )}
            </div>
            <div className="min-w-0">
              {user.name && <p className="truncate text-sm font-semibold">{user.name}</p>}
              <p className="truncate text-xs">{user.email}</p>
            </div>
          </div>

          <div className="my-1 border-t border-gray-100" />

          {/* Logout */}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-sm"
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
