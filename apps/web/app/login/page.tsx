import Link from 'next/link';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  const href = `${api.replace(/\/$/, '')}/v1/auth/google/start`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFD] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white px-8 py-10 shadow-lg">
        {/* Logo + App name */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B57D0]">
            {/* Calendar icon */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-7 w-7 text-white"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">Calendar</h1>
            <p className="text-sm text-gray-500">Sign in to manage your schedule</p>
          </div>
        </div>

        {/* Sign in button */}
        <Link
          href={href}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          {/* Google "G" logo */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Link>

        <p className="mt-6 text-center text-xs text-gray-400">
          By signing in, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
