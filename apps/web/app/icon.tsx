import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  const now = new Date();
  const day = String(now.getDate());
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

  return new ImageResponse(
    <div
      style={{
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        borderRadius: 14,
        border: '2px solid #E5E7EB',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            background: '#0B57D0',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {weekday}
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 800,
            color: '#111827',
            lineHeight: 1,
          }}
        >
          {day}
        </div>
      </div>
    </div>,
    { width: 64, height: 64 },
  );
}
