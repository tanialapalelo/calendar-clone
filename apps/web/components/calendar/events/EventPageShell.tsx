'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';

export function EventPageShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-[#F0F4F9] dark:bg-gray-950">
      {/* Content */}
      <div className="w-full flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
