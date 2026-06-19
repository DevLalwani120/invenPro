import { useState } from "react";
import {
  LayoutDashboard, Package, Layers, BookUser,
  Menu, X, RefreshCw, LogOut, ShieldCheck,
} from "lucide-react";
import Dashboard    from "./pages/Dashboard";
import ItemMaster   from "./pages/ItemMaster";
import BatchManager from "./pages/BatchManager";
import LedgerMaster from "./pages/LedgerMaster";
import AdminPanel   from "./pages/AdminPanel";
import Auth         from "./pages/Auth";
import AlertBell    from "./components/AlertBell";
import { useInventory }  from "./hooks/useInventory";
import { useAuth }       from "./hooks/useAuth";
import { useAdmin }      from "./hooks/useAdmin";
import { logout }        from "./firebase/auth";
import { ADMIN_EMAIL }   from "./firebase/config";

const NAV = [
  { id:"dashboard", label:"Dashboard",     icon:LayoutDashboard },
  { id:"items",     label:"Item Master",   icon:Package          },
  { id:"batches",   label:"Batch Manager", icon:Layers           },
  { id:"ledger",    label:"Ledger Master", icon:BookUser         },
];

export default function App() {
  const [page,     setPage]     = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const {
    items, batches, ledger, stockMap,
    lowStockItems, expiringBatches, expiredBatches,
    totalAlerts, loading, error, refetch,
    addItem, updateItem, deleteItem,
    addBatch, updateBatch, deleteBatch,
    addLedger, updateLedger, deleteLedger,
  } = useInventory();

  const {
    categories, units, events, users, loginLogs,
    loading: adminLoading, error: adminError, refetch: adminRefetch,
    addCategory, updateCategory, deleteCategory,
    addUnit, updateUnit, deleteUnit,
    addEvent, updateEvent, deleteEvent,
    updateUser,
  } = useAdmin();

  const navigate = (id) => { setPage(id); setSideOpen(false); };

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const enrichedLowStock = lowStockItems.map(item => ({
    ...item, _stock: stockMap[item.id] ?? 0
  }));

  if (authLoading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"/>
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  );

  if (!user) return <Auth/>;

  return (
    <div className="h-screen flex overflow-hidden"
      style={{background:"#f8fafc", fontFamily:"'DM Sans',sans-serif"}}>

      {sideOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={()=>setSideOpen(false)}/>
      )}

      <aside className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transition-transform duration-300
        lg:translate-x-0 lg:static lg:shadow-none shadow-2xl
        ${sideOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{background:"linear-gradient(160deg,#0f2027,#203a43,#0f766e)"}}>

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
            <p className="text-teal-300/60 text-xs mt-1.5 ml-0.5">
              {isAdmin ? "Admin Dashboard" : "Inventory Management"}
            </p>
          </div>
          <button onClick={()=>setSideOpen(false)} className="lg:hidden text-white/50 hover:text-white">
            <X size={20}/>
          </button>
        </div>

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

          {isAdmin && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-white/30 text-xs font-semibold uppercase tracking-wide">Administration</p>
              </div>
              <button onClick={()=>navigate("admin")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all
                  ${page === "admin" ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:bg-white/8 hover:text-white"}`}>
                <ShieldCheck size={17}/>
                Admin Panel
              </button>
            </>
          )}
        </nav>

        <div className="p-3 m-3 space-y-2 shrink-0">
          <div className="p-3 rounded-xl bg-white/8 border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Logged in as</p>
              {isAdmin && (
                <span className="text-[10px] font-bold bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded-md">ADMIN</span>
              )}
            </div>
            <p className="text-white/90 text-sm font-semibold truncate">{user.displayName || "User"}</p>
            <p className="text-teal-300/60 text-xs truncate">{user.email}</p>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl
              text-white/60 hover:text-white hover:bg-red-500/20 text-sm font-medium transition-all">
            <LogOut size={15}/> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header className="shrink-0 bg-white border-b border-slate-100 px-4 lg:px-8 py-5 flex items-center gap-3 shadow-sm">
          <button onClick={()=>setSideOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600">
            <Menu size={20}/>
          </button>
          <div className="flex-1">
            <h2 className="text-slate-800 font-bold text-lg" style={{fontFamily:"'Syne',sans-serif"}}>
              {page === "admin" ? "Admin Panel" : NAV.find(n=>n.id===page)?.label}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">InvenPro · Inventory Management System</p>
          </div>

          <AlertBell
            expiringBatches={expiringBatches}
            expiredBatches={expiredBatches}
            lowStockItems={enrichedLowStock}
            itemMap={itemMap}
            onNavigate={navigate}
          />

          <button onClick={refetch}
            className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh data">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
          </button>
        </header>

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
            </div>
          )}

          {!loading && page === "dashboard" && (
            <Dashboard items={items} batches={batches} stockMap={stockMap}
              lowStockItems={lowStockItems} expiringBatches={expiringBatches} expiredBatches={expiredBatches}/>
          )}
          {!loading && page === "items" && (
            <ItemMaster items={items} stockMap={stockMap}
              addItem={addItem} updateItem={updateItem} deleteItem={deleteItem}
              categories={categories} units={units}/>
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

          {!loading && page === "admin" && isAdmin && (
            <AdminPanel
              categories={categories} units={units} events={events}
              users={users} loginLogs={loginLogs}
              loading={adminLoading} error={adminError} refetch={adminRefetch}
              addCategory={addCategory} updateCategory={updateCategory} deleteCategory={deleteCategory}
              addUnit={addUnit} updateUnit={updateUnit} deleteUnit={deleteUnit}
              addEvent={addEvent} updateEvent={updateEvent} deleteEvent={deleteEvent}
              updateUser={updateUser}
            />
          )}
          {!loading && page === "admin" && !isAdmin && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <ShieldCheck size={48} className="opacity-20"/>
              <p className="font-semibold text-slate-500">Access Denied</p>
              <p className="text-sm">You don't have permission to view this page.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}