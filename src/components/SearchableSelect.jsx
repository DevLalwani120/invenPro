import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, X, Search } from "lucide-react";

/**
 * SearchableSelect — a react-select-style dropdown with no extra dependency.
 * Type to filter, click (or Enter) to choose, Escape/X to clear.
 *
 * options: [{ value, label, sub? }]   (sub = optional small grey subtitle line)
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  clearable = true,
}) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const [active, setActive] = useState(0);
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.label?.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => { if (open) { setActive(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

  const commit = (opt) => {
    onChange(opt ? opt.value : "");
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) commit(filtered[active]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm text-left
          bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400
          ${disabled ? "opacity-60 cursor-not-allowed border-slate-200" : "border-slate-200 hover:border-teal-300 cursor-pointer"}`}
      >
        <span className={selected ? "text-slate-800" : "text-slate-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && clearable && !disabled && (
            <X size={14} className="text-slate-400 hover:text-red-500"
              onClick={(e) => { e.stopPropagation(); commit(null); }}/>
          )}
          <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}/>
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-40 mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search size={14} className="text-slate-400 shrink-0"/>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to search…"
              className="w-full text-sm focus:outline-none placeholder:text-slate-300"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-xs text-slate-400 text-center">No matches</p>
            ) : (
              filtered.map((opt, i) => (
                <div
                  key={opt.value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(opt)}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex flex-col
                    ${i === active ? "bg-teal-50 text-teal-800" : "text-slate-700"}
                    ${opt.value === value ? "font-semibold" : ""}`}
                >
                  <span>{opt.label}</span>
                  {opt.sub && <span className="text-xs text-slate-400">{opt.sub}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
