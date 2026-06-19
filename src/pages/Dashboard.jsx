import { format, differenceInDays } from "date-fns";
import { Package, Clock, PackageX, TrendingDown, CheckCircle, AlertTriangle, ShieldAlert } from "lucide-react";

function StatCard({ icon, label, value, bg, iconColor }) {
  return (
    <div className={`rounded-2xl p-5 ${bg} flex items-center gap-4`}>
      <div className={`p-3 rounded-xl bg-white/60 ${iconColor}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function formatStock(item, stock) {
  if (item.hasSecondaryUnit && item.conversionRate > 0) {
    const secondaryQty = (stock * Number(item.conversionRate)).toFixed(2).replace(/\.?0+$/, "");
    return (
      <>
        <span className="font-bold">{stock}</span>
        <span className="text-slate-400 text-xs ml-1">{item.unit}</span>
        <span className="text-teal-600 text-xs ml-1.5 bg-teal-50 px-1.5 py-0.5 rounded-md">
          ({secondaryQty} {item.secondaryUnit})
        </span>
      </>
    );
  }
  return (
    <>
      <span className="font-bold">{stock}</span>
      <span className="text-slate-400 text-xs ml-1">{item.unit}</span>
    </>
  );
}

export default function Dashboard({ items, batches, stockMap, lowStockItems, expiringBatches, expiredBatches }) {
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const today   = new Date();

  const allAlerts = [
    ...expiredBatches.map(b  => ({ ...b, _type:"expired"  })),
    ...expiringBatches.map(b => ({ ...b, _type:"expiring" })),
  ].sort((a, b) => (a.expiryDate || 0) - (b.expiryDate || 0));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800" style={{fontFamily:"'Syne',sans-serif"}}>Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">{format(today,"EEEE, dd MMMM yyyy")} · Live overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Package size={20}/>}     label="Total Items"     value={items.length}           bg="bg-teal-50"   iconColor="text-teal-600"/>
        <StatCard icon={<Clock size={20}/>}        label="Expiring Soon"   value={expiringBatches.length} bg="bg-orange-50" iconColor="text-orange-500"/>
        <StatCard icon={<PackageX size={20}/>}     label="Expired Batches" value={expiredBatches.length}  bg="bg-red-50"    iconColor="text-red-500"/>
        <StatCard icon={<TrendingDown size={20}/>} label="Low Stock"       value={lowStockItems.length}   bg="bg-yellow-50" iconColor="text-yellow-600"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiry Alerts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-orange-500"/>
              <h2 className="font-bold text-slate-800 text-base" style={{fontFamily:"'Syne',sans-serif"}}>Expiry Alerts</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">{allAlerts.length} issues</span>
          </div>
          <div className="px-5 py-2 max-h-72 overflow-y-auto">
            {allAlerts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-400">
                <CheckCircle size={32} className="text-emerald-400 mb-2"/>
                <p className="text-sm font-medium">All clear! No expiry alerts</p>
              </div>
            ) : allAlerts.map((b) => {
              const item    = itemMap[b.itemId];
              const days    = b.expiryDate ? differenceInDays(b.expiryDate, today) : null;
              const expired = b._type === "expired";
              return (
                <div key={b.id} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
                  <span className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0
                    ${expired ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
                    {expired ? <PackageX size={14}/> : <Clock size={14}/>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{item?.name ?? "Unknown"}</p>
                    <p className="text-slate-400 text-xs truncate">Batch: {b.batchNo} · Qty: {b.quantity} {item?.unit ?? ""} · {b.expiryDate ? format(b.expiryDate,"dd MMM yyyy") : "N/A"}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg
                    ${expired ? "bg-red-100 text-red-600" : days <= 7 ? "bg-orange-100 text-orange-600" : "bg-yellow-100 text-yellow-700"}`}>
                    {expired ? "EXPIRED" : `${days}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <TrendingDown size={18} className="text-yellow-600"/>
              <h2 className="font-bold text-slate-800 text-base" style={{fontFamily:"'Syne',sans-serif"}}>Low Stock</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">{lowStockItems.length} items</span>
          </div>
          <div className="px-5 py-2 max-h-72 overflow-y-auto">
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-400">
                <CheckCircle size={32} className="text-emerald-400 mb-2"/>
                <p className="text-sm font-medium">All items sufficiently stocked</p>
              </div>
            ) : lowStockItems.map((item) => {
              const stock = stockMap[item.id] ?? 0;
              const pct   = item.minStockLevel ? Math.min((stock / Number(item.minStockLevel)) * 100, 100) : 0;
              return (
                <div key={item.id} className="py-3 border-b border-slate-50 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-800 text-sm">{item.name}</span>
                    <span className="text-xs font-bold text-red-500">{stock} / {item.minStockLevel} {item.unit}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width:`${pct}%`, background: pct<30?"#ef4444":pct<60?"#f59e0b":"#10b981" }}/>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.category} · Min: {item.minStockLevel} {item.unit}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stock Overview */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-base" style={{fontFamily:"'Syne',sans-serif"}}>Stock Overview</h2>
          <span className="text-xs text-slate-400">{items.length} items</span>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <Package size={36} className="opacity-20 mb-2"/>
            <p className="text-sm">No items yet — go to Item Master to add items</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                  {["Item","Category","Current Stock","Min Level","Status"].map(h=>(
                    <th key={h} className="text-left px-5 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const stock = stockMap[item.id] ?? 0;
                  const isLow = item.minStockLevel != null && stock <= Number(item.minStockLevel);
                  return (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-teal-50 text-teal-700">{item.category}</span>
                      </td>
                      <td className={`px-5 py-4 ${isLow ? "text-red-500" : "text-slate-800"}`}>
                        {formatStock(item, stock)}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{item.minStockLevel ?? "—"}</td>
                      <td className="px-5 py-4">
                        {isLow
                          ? <span className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit"><AlertTriangle size={11}/>Low</span>
                          : <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit"><CheckCircle size={11}/>OK</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}