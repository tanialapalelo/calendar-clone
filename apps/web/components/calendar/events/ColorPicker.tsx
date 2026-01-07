'use client';

import { useState, useCallback, useRef, CSSProperties, useEffect } from 'react';
import { PALETTE as DEFAULT_PALETTE } from '@/constants';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

type Props = {
  value?: string;
  onChange: (hex: string) => void;
  palette?: string[]; // optional override, defaults to constants PALETTE
  ariaLabel?: string;
};

export default function ColorPicker({
  value,
  onChange,
  palette = DEFAULT_PALETTE,
  ariaLabel = 'Select event color',
}: Props) {
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties | undefined>(undefined);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const toggle = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const handleSelect = (hex: string) => {
    onChange(hex);
    setOpen(false);
    // return focus to button after selecting
    btnRef.current?.focus();
  };

  const selected = (value ?? '').toLowerCase();
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2 rounded-md bg-gray-200 p-3" onClick={toggle}>
        <button
          type="button"
          className={`h-4 w-4 rounded-full ring-transparent`}
          style={{ background: selected }}
          aria-label={`Color ${selected}`}
        />

        <ChevronDownIcon size={16} />
      </div>
      {open && (
        <div ref={panelRef} style={popupStyle} role="menu" aria-label="Color palette">
          <div className="rounded-lg bg-white p-3 shadow-lg ring-1 ring-black/5">
            <div className="grid grid-cols-3 gap-3">
              {palette.map((hex) => {
                const isSelected = selected === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    data-swatch
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    aria-label={`Color ${hex}`}
                    onClick={() => handleSelect(hex)}
                    className={`relative flex h-5 w-5 items-center justify-center rounded-full focus:ring-2 focus:outline-none ${
                      isSelected ? 'ring-2 ring-[#0B57D0] ring-offset-2' : 'ring-0'
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <CheckIcon size={14} className="text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
