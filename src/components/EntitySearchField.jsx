import { useEffect, useRef, useState } from "react";

// A blank-by-default search field for picking an existing customer/product
// (or anything else), with an "+ Add New" action alongside it.
export default function EntitySearchField({
  items, value, onChange, displayFn, subFn, searchFields, placeholder, onAddNew, addNewLabel,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const selected = items.find((i) => i.id === value);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matches = query
    ? items.filter((i) => searchFields.some((f) => (i[f] || "").toLowerCase().includes(query.toLowerCase())))
    : items;

  if (selected) {
    return (
      <div className="flex items-center gap-2 border border-line rounded-lg px-3 py-2 text-sm bg-white">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{displayFn(selected)}</div>
          {subFn && <div className="text-xs text-muted truncate">{subFn(selected)}</div>}
        </div>
        <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-muted hover:text-rust shrink-0">
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="border border-line rounded-lg px-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2"
      />
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {matches.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { onChange(item.id); setQuery(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-paper text-sm border-b border-line last:border-0"
            >
              <div className="font-medium">{displayFn(item)}</div>
              {subFn && <div className="text-xs text-muted">{subFn(item)}</div>}
            </button>
          ))}
          {matches.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted">No matches.</div>
          )}
          {onAddNew && (
            <button
              type="button"
              onClick={() => { setOpen(false); onAddNew(); }}
              className="w-full text-left px-3 py-2 hover:bg-paper text-sm font-semibold text-ink2 border-t border-line"
            >
              + {addNewLabel || "Add New"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
