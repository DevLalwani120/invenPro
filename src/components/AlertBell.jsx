import { useState, useRef, useEffect } from "react";
import { Bell, X, PackageX, Clock, TrendingDown, ChevronRight } from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function AlertBell({ expiringBatches, expiredBatches, lowStockItems, itemMap, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const total           = expiringBatches.length + expiredBatches.length + lowStockItems.length;

  // Close on outside click

  
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const today = new Date();

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button onClick={() => setOpen(o => !o)}
        className={`relative p-2.5 rounded-xl transition-colors
          ${total > 0
            ? "bg-red-50 hover:bg-red-100 text-red-500"
            : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          }`}>
        <Bell size={18} className={total > 0 ? "animate-[ring_1s_ease-in-out_infinite]" : ""}/>
        {total > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold
            rounded-full flex items-center justify-center shadow">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-slate-500"/>
              <span className="font-bold text-slate-700 text-sm">Alerts</span>
              {total > 0 && (
                <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">{total}</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400">
              <X size={14}/>
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {total === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400">
                <Bell size={32} className="opacity-20 mb-2"/>
                <p className="text-sm font-medium">All clear! No alerts</p>
                <p className="text-xs mt-1">Everything is stocked and fresh</p>
              </div>
            ) : (
              <>
                {/* Expired */}
                {expiredBatches.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                      <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
                        🔴 Expired Stock — {expiredBatches.length}
                      </span>
                    </div>
                    {expiredBatches.map(b => {
                      const item = itemMap[b.itemId];
                      return (
                        <div key={b.id}
                          className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-red-50/40 transition-colors cursor-pointer"
                          onClick={() => { onNavigate("batches"); setOpen(false); }}>
                          <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                            <PackageX size={13} className="text-red-500"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item?.name ?? "Unknown"}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Batch: {b.batchNo} · Qty: {b.quantity} {item?.unit ?? ""}
                            </p>
                            <p className="text-xs text-red-500 font-semibold mt-0.5">
                              Expired: {b.expiryDate ? format(b.expiryDate, "dd MMM yyyy") : "N/A"}
                            </p>
                          </div>
                          <ChevronRight size={13} className="text-slate-300 mt-1 shrink-0"/>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expiring soon */}
                {expiringBatches.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
                      <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">
                        🟠 Expiring Soon — {expiringBatches.length}
                      </span>
                    </div>
                    {expiringBatches.map(b => {
                      const item = itemMap[b.itemId];
                      const days = b.expiryDate ? differenceInDays(b.expiryDate, today) : null;
                      return (
                        <div key={b.id}
                          className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-orange-50/40 transition-colors cursor-pointer"
                          onClick={() => { onNavigate("batches"); setOpen(false); }}>
                          <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Clock size={13} className="text-orange-500"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item?.name ?? "Unknown"}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Batch: {b.batchNo} · Qty: {b.quantity} {item?.unit ?? ""}
                            </p>
                            <p className="text-xs text-orange-500 font-semibold mt-0.5">
                              Expires: {b.expiryDate ? format(b.expiryDate, "dd MMM yyyy") : "N/A"}
                              {days !== null && <span className="ml-1.5 bg-orange-100 px-1.5 py-0.5 rounded-md">{days}d left</span>}
                            </p>
                          </div>
                          <ChevronRight size={13} className="text-slate-300 mt-1 shrink-0"/>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Low stock */}
                {lowStockItems.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100">
                      <span className="text-xs font-bold text-yellow-700 uppercase tracking-wide">
                        🟡 Low Stock — {lowStockItems.length}
                      </span>
                    </div>
                    {lowStockItems.map(item => (
                      <div key={item.id}
                        className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-yellow-50/40 transition-colors cursor-pointer"
                        onClick={() => { onNavigate("items"); setOpen(false); }}>
                        <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0 mt-0.5">
                          <TrendingDown size={13} className="text-yellow-600"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.category}</p>
                          <p className="text-xs text-yellow-600 font-semibold mt-0.5">
                            Stock: {item._stock} {item.unit} · Min: {item.minStockLevel} {item.unit}
                          </p>
                        </div>
                        <ChevronRight size={13} className="text-slate-300 mt-1 shrink-0"/>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {total > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
              <button onClick={() => { onNavigate("dashboard"); setOpen(false); }}
                className="text-xs text-teal-600 font-semibold hover:text-teal-700 transition-colors">
                View all on Dashboard →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
