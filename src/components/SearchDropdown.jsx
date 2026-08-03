import { useState, useRef, useEffect } from "react";

export default function SearchDropdown({ query, onQueryChange, suggestions, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative flex-1 min-w-[200px]">
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => { onQueryChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="border border-line rounded-lg px-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2"
      />
      {open && query && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {suggestions.slice(0, 8).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onSelect(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-paper text-sm border-b border-line last:border-0"
            >
              <div className="font-medium">{s.label}</div>
              {s.sublabel && <div className="text-xs text-muted">{s.sublabel}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
