import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Calendar',
    template: '%s · Calendar',
  },
  description: 'Google Calendar clone built with Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ymd = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  return (
    <html lang="en">
      <head>
        <link rel="icon" href={`/icon.png?v=${ymd}`} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[#F8FAFD] antialiased`}>
        {children}
      </body>
    </html>
  );
}
