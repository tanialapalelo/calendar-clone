'use client';

import { useEffect } from 'react';

type ShortcutHandlers = {
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onChangeView: (v: CalendarView) => void;
  onNewEvent: () => void;
};

/**
 * Global keyboard shortcuts matching Google Calendar:
 *   t        → Today
 *   d        → Day view
 *   w        → Week view
 *   m        → Month view
 *   y        → Year view
 *   p / k    → Previous period
 *   n / j    → Next period
 *   c        → Create new event
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const { onToday, onPrev, onNext, onChangeView, onNewEvent } = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if focus is inside an input / textarea / select / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Skip modifier key combos (ctrl/cmd/alt shortcuts are reserved by browser/OS)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 't':
          e.preventDefault();
          onToday();
          break;
        case 'd':
          e.preventDefault();
          onChangeView('day');
          break;
        case 'w':
          e.preventDefault();
          onChangeView('week');
          break;
        case 'm':
          e.preventDefault();
          onChangeView('month');
          break;
        case 'y':
          e.preventDefault();
          onChangeView('year');
          break;
        case 'p':
        case 'k':
        case 'ArrowLeft':
          e.preventDefault();
          onPrev();
          break;
        case 'n':
        case 'j':
        case 'ArrowRight':
          e.preventDefault();
          onNext();
          break;
        case 'c':
          e.preventDefault();
          onNewEvent();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToday, onPrev, onNext, onChangeView, onNewEvent]);
}
