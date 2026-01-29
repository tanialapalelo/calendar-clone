import Link from 'next/link';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  const href = `${api.replace(/\/$/, '')}/v1/auth/google/start`;

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-gray-600">Sign in to view and manage your calendar events.</p>

      <Link
        className="mt-6 inline-flex rounded bg-[#0B57D0] px-4 py-2 font-semibold text-white"
        href={href}
      >
        Continue with Google
      </Link>
    </div>
  );
}
