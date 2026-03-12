'use client';

import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('light');

  // On mount: read saved preference
  useEffect(() => {
    const saved = (localStorage.getItem('theme') ?? 'light') as ThemeMode;
    setThemeState(saved);
    applyTheme(saved);

    // Listen to system preference changes (only relevant when mode === 'system')
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if ((localStorage.getItem('theme') ?? 'light') === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = (mode: ThemeMode) => {
    localStorage.setItem('theme', mode);
    setThemeState(mode);
    applyTheme(mode);
  };

  return { theme, setTheme };
}
