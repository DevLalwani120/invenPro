import { useState } from "react";
import { Calendar } from "lucide-react";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subMonths,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, subYears,
  format,
} from "date-fns";

/**
 * Returns { from: Date, to: Date } for a given preset key.
 */
export function getPresetRange(preset) {
  const now = new Date();
  switch (preset) {
    case "today":      return { from: startOfDay(now), to: endOfDay(now) };
    case "thisWeek":   return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "thisMonth":  return { from: startOfMonth(now), to: endOfMonth(now) };
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case "thisQuarter": return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "thisYear":    return { from: startOfYear(now), to: endOfYear(now) };
    case "lastYear": {
      const ly = subYears(now, 1);
      return { from: startOfYear(ly), to: endOfYear(ly) };
    }
    default: return { from: null, to: null };
  }
}

const PRESETS = [
  { key: "today",       label: "Today" },
  { key: "thisWeek",    label: "This Week" },
  { key: "thisMonth",   label: "This Month" },
  { key: "lastMonth",   label: "Last Month" },
  { key: "thisQuarter", label: "This Quarter" },
  { key: "thisYear",    label: "This Year" },
  { key: "lastYear",    label: "Last Year" },
];

/**
 * Reusable date-range picker with quick presets + custom From/To.
 * Calls onChange({ from: Date|null, to: Date|null }) whenever range changes.
 * Passing { from: null, to: null } means "All Time" (no filtering).
 */
export function DateRangePicker({ value, onChange }) {
  const [activePreset, setActivePreset] = useState(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");

  const applyPreset = (key) => {
    setActivePreset(key);
    setCustomFrom("");
    setCustomTo("");
    onChange(getPresetRange(key));
  };

  const applyCustom = (from, to) => {
    setActivePreset(null);
    onChange({
      from: from ? startOfDay(new Date(from)) : null,
      to:   to   ? endOfDay(new Date(to))     : null,
    });
  };

  const clearAll = () => {
    setActivePreset(null);
    setCustomFrom("");
    setCustomTo("");
    onChange({ from: null, to: null });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
          <Calendar size={13}/> Date Range
        </span>
        {PRESETS.map(p => (
          <button key={p.key} type="button" onClick={()=>applyPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${activePreset === p.key
                ? "bg-teal-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {p.label}
          </button>
        ))}
        <button type="button" onClick={clearAll}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
            ${!activePreset && !customFrom && !customTo
              ? "bg-teal-600 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          All Time
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input type="date" value={customFrom}
          onChange={e => { setCustomFrom(e.target.value); applyCustom(e.target.value, customTo); }}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        <span className="text-slate-400 text-sm">to</span>
        <input type="date" value={customTo}
          onChange={e => { setCustomTo(e.target.value); applyCustom(customFrom, e.target.value); }}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
      </div>

      {(value?.from || value?.to) && (
        <p className="text-xs text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg w-fit">
          Showing: {value.from ? format(value.from, "dd MMM yyyy") : "Beginning"} → {value.to ? format(value.to, "dd MMM yyyy") : "Today"}
        </p>
      )}
    </div>
  );
}
