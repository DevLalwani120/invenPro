import { useState } from "react";
import {
  LayoutDashboard, Package, Layers, BookUser,
  Menu, X, Bell, RefreshCw, LogOut,
} from "lucide-react";
import Dashboard    from "./pages/Dashboard";
import ItemMaster   from "./pages/ItemMaster";
import BatchManager from "./pages/BatchManager";
import LedgerMaster from "./pages/LedgerMaster";
import Auth         from "./pages/Auth";
import { useInventory } from "./hooks/useInventory";
import { useAuth }      from "./hooks/useAuth";
import { logout }       from "./firebase/auth";

const NAV = [
  { id:"dashboard", label:"Dashboard",     icon:LayoutDashboard },
  { id:"items",     label:"Item Master",   icon:Package          },
  { id:"batches",   label:"Batch Manager", icon:Layers           },
  { id:"ledger",    label:"Ledger Master", icon:BookUser         },
];

export default function App() {
  const [page,     setPage]     = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(false);

  // ── Auth — must be before any early returns ──────────────────
  const { user, loading: authLoading } = useAuth();

  // ── Inventory data ────────────────────────────────────────────
  const {
    items, batches, ledger, stockMap,
    lowStockItems, expiringBatches, expiredBatches,
    totalAlerts, loading, error, refetch,
    addItem, updateItem, deleteItem,
    addBatch, updateBatch, deleteBatch,
    addLedger, updateLedger, deleteLedger,
  } = useInventory();

  const navigate = (id) => { setPage(id); setSideOpen(false); };

  // ── Auth loading screen ───────────────────────────────────────
  if (authLoading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"/>
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  );

  // ── Not logged in ─────────────────────────────────────────────
  if (!user) return <Auth/>;

  // ── Main app ──────────────────────────────────────────────────
  return (
    <div className="h-screen flex overflow-hidden"
      style={{background:"#f8fafc", fontFamily:"'DM Sans',sans-serif"}}>

      {sideOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={()=>setSideOpen(false)}/>
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transition-transform duration-300
        lg:translate-x-0 lg:static lg:shadow-none shadow-2xl
        ${sideOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{background:"linear-gradient(160deg,#0f2027,#203a43,#0f766e)"}}>

        {/* Logo */}
        <div className="px-6 py-7 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-400/20 flex items-center justify-center">
                <Package size={18} className="text-teal-300"/>
              </div>
              <span className="text-white font-bold text-xl" style={{fontFamily:"'Syne',sans-serif"}}>
                InvenPro
              </span>
            </div>
            <p className="text-teal-300/60 text-xs mt-1.5 ml-0.5">Inventory Management</p>
          </div>
          <button onClick={()=>setSideOpen(false)} className="lg:hidden text-white/50 hover:text-white">
            <X size={20}/>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button key={id} onClick={()=>navigate(id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all
                  ${active ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:bg-white/8 hover:text-white"}`}>
                <Icon size={17}/>
                {label}
                {id === "dashboard" && totalAlerts > 0 && (
                  <span className="ml-auto text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">
                    {totalAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom — user info + logout */}
        <div className="p-3 m-3 space-y-2 shrink-0">
          {/* User info */}
          <div className="p-3 rounded-xl bg-white/8 border border-white/10">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-1">Logged in as</p>
            <p className="text-white/90 text-sm font-semibold truncate">
              {user.displayName || "User"}
            </p>
            <p className="text-teal-300/60 text-xs truncate">{user.email}</p>
          </div>
          {/* Logout button */}
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl
              text-white/60 hover:text-white hover:bg-red-500/20
              text-sm font-medium transition-all">
            <LogOut size={15}/> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Navbar */}
        <header className="shrink-0 bg-white border-b border-slate-100 px-4 lg:px-8 py-5 flex items-center gap-4 shadow-sm">
          <button onClick={()=>setSideOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600">
            <Menu size={20}/>
          </button>
          <div className="flex-1">
            <h2 className="text-slate-800 font-bold text-lg" style={{fontFamily:"'Syne',sans-serif"}}>
              {NAV.find(n=>n.id===page)?.label}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">InvenPro · Inventory Management System</p>
          </div>
          {totalAlerts > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
              <Bell size={15} className="text-red-500 animate-bounce"/>
              <span className="text-red-500 text-xs font-bold">
                {totalAlerts} alert{totalAlerts > 1 ? "s" : ""}
              </span>
            </div>
          )}
          <button onClick={refetch}
            className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh data">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"/>
              <p className="text-sm">Loading from Firebase…</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-sm text-red-600">
              <strong>Firebase Error:</strong> {error}
              <br/>
              <span className="text-xs text-red-400 mt-1 block">
                Check your Firebase config in src/firebase/config.js and ensure Firestore rules allow read/write.
              </span>
            </div>
          )}

          {!loading && page === "dashboard" && (
            <Dashboard items={items} batches={batches} stockMap={stockMap}
              lowStockItems={lowStockItems} expiringBatches={expiringBatches} expiredBatches={expiredBatches}/>
          )}
          {!loading && page === "items" && (
            <ItemMaster items={items} stockMap={stockMap}
              addItem={addItem} updateItem={updateItem} deleteItem={deleteItem}/>
          )}
          {!loading && page === "batches" && (
            <BatchManager items={items} batches={batches} ledger={ledger}
              addBatch={addBatch} updateBatch={updateBatch} deleteBatch={deleteBatch}
              addLedger={addLedger}/>
          )}
          {!loading && page === "ledger" && (
            <LedgerMaster ledger={ledger}
              addLedger={addLedger} updateLedger={updateLedger} deleteLedger={deleteLedger}/>
          )}
        </main>
      </div>
    </div>
  );
}