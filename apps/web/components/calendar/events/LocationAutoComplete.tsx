'use client';

import { useEffect, useRef, useState } from 'react';

export type PlaceSuggestion = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
} & Record<string, unknown>;

export default function LocationAutocomplete(props: {
  value?: string;
  onChange: (val: string) => void;
  onSelect?: (place: PlaceSuggestion) => void;
  placeholder?: string;
  minLength?: number;
  className?: string;
}) {
  const {
    value = '',
    onChange,
    onSelect,
    placeholder = 'Add location',
    minLength = 2,
    className,
  } = props;

  const [input, setInput] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const controllerRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Sync input when parent programmatically changes value (no effect needed)
  if (value !== prevValue) {
    setPrevValue(value);
    setInput(value);
  }

  // Debounced search
  useEffect(() => {
    if ((input ?? '').trim().length < minLength) {
      // No fetch needed; UI just shows nothing.
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching is a legitimate external-system sync; loading/open flags must reflect the in-flight request
    setLoading(true);
    setOpen(true);

    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    const id = window.setTimeout(() => {
      const q = encodeURIComponent(input.trim());
      // Nominatim public search endpoint (no API key). Respect usage limits in production.
      const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=6`;
      fetch(url, {
        signal: ctrl.signal,
        headers: { 'Accept-Language': navigator.language || 'en' },
      })
        .then((res) => res.json())
        .then((data: unknown) => {
          const items = Array.isArray(data) ? data : [];
          const list = items.map((d) => {
            const item = d as Record<string, unknown>;
            return {
              place_id: String(item.place_id ?? item.osm_id ?? Math.random()),
              display_name: String(item.display_name ?? ''),
              lat: String(item.lat ?? ''),
              lon: String(item.lon ?? ''),
              ...item,
            } as PlaceSuggestion;
          });
          setSuggestions(list);
          setHighlight(0);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          console.error('Location search error', err);
          setSuggestions([]);
        })
        .finally(() => {
          setLoading(false);
          controllerRef.current = null;
        });
    }, 300); // debounce 300ms

    return () => {
      clearTimeout(id);
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [input, minLength]);

  // Click outside closes suggestions
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  function handleSelect(place: PlaceSuggestion) {
    setInput(place.display_name);
    onChange(place.display_name);
    setOpen(false);
    if (onSelect) onSelect(place);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[highlight]) handleSelect(suggestions[highlight]);
      else {
        // commit the input even if no suggestion selected
        onChange(input);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <input
        type="text"
        value={input}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setInput(v);
          onChange(v);
          if (v.trim().length < minLength) {
            setSuggestions([]);
            setOpen(false);
            setLoading(false);
          }
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded border px-3 py-2 text-sm"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="location-suggestions"
        aria-activedescendant={
          open && suggestions[highlight] ? `loc-${suggestions[highlight].place_id}` : undefined
        }
      />

      {open && (suggestions.length > 0 || loading) && (
        <div
          id="location-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-white shadow-sm dark:bg-gray-700"
        >
          {loading && suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
          ) : null}

          {suggestions.map((s, idx) => (
            <button
              key={s.place_id}
              id={`loc-${s.place_id}`}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${idx === highlight ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => handleSelect(s)}
            >
              <div className="truncate font-medium">{s.display_name}</div>
              <div className="text-xs text-gray-500">
                {s.lat && s.lon ? `${s.lat.slice(0, 7)}, ${s.lon.slice(0, 7)}` : ''}
              </div>
            </button>
          ))}

          {!loading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
