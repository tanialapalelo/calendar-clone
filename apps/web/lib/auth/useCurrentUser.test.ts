import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ApiError } from '@/lib/api/client';
import { useCurrentUser } from './useCurrentUser';

// Mock apiFetch so tests never hit the network.
// The mock is reset in beforeEach so each test starts clean.
vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

// TODO(human): import the mocked apiFetch and write the three test scenarios below.
// Hint: import { apiFetch } from '@/lib/api/client' at the top, then cast it:
//   const mockFetch = apiFetch as ReturnType<typeof vi.fn>;
// In beforeEach: mockFetch.mockReset();

describe('useCurrentUser', () => {
  // TODO(human): implement the three test cases:
  //
  // 1. starts in "loading" state synchronously (no await needed, just check initial render)
  //
  // 2. transitions to "authenticated" with the user object when apiFetch resolves
  //    with { ok: true, user: { sub: '1', email: 'test@example.com' } }
  //
  // 3. transitions to "unauthenticated" when apiFetch rejects with ApiError(401)
  //    (use: new ApiError(401, 'Unauthorized'))
  //
  // Bonus: add a 4th test for network errors (reject with a generic Error) — should
  // also result in "unauthenticated" (the hook intentionally falls back to unauthed)
});
