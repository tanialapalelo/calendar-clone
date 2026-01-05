'use client';

import { useState } from 'react';
import { PALETTE } from '@/constants';

export default function ColorPicker(props: { value?: string; onChange: (hex: string) => void }) {
  const { value, onChange } = props;

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        {PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            className={`h-8 w-8 rounded-full ring-2 ${value === hex ? 'ring-[#0B57D0] ring-offset-2' : 'ring-transparent'}`}
            style={{ background: hex }}
            aria-label={`Color ${hex}`}
          />
        ))}
      </div>
    </div>
  );
}
