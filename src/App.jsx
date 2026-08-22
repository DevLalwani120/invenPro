import { useState } from "react";
import {
  LayoutDashboard, Package, Layers, BookUser, FileText, BookOpen, ClipboardList, FileSpreadsheet,
  Menu, X, RefreshCw, LogOut, ShieldCheck, Snowflake,
} from "lucide-react";
import Dashboard    from "./pages/Dashboard";
import ItemMaster   from "./pages/ItemMaster";
import ItemImport   from "./pages/ItemImport";
import ConsumptionImport from "./pages/ConsumptionImport";
import SewaImport from "./pages/SewaImport";
import BatchManager from "./pages/BatchManager";
import BatchImport  from "./pages/BatchImport";
import LedgerMaster from "./pages/LedgerMaster";
import EntrySheet   from "./pages/EntrySheet";
import BatchLedger  from "./pages/BatchLedger";
import StockReport  from "./pages/StockReport";
import ColdStorageReport from "./pages/ColdStorageReport";
import AdminPanel   from "./pages/AdminPanel";
import Auth         from "./pages/Auth";
import AlertBell    from "./components/AlertBell";
import { useInventory }  from "./hooks/useInventory";
import { useAuth }       from "./hooks/useAuth";
import { useAdmin }      from "./hooks/useAdmin";
import { useEntries }    from "./hooks/useEntries";
import { logout }        from "./firebase/auth";
import { ADMIN_EMAIL }   from "./firebase/config";

const NAV = [
  { id:"dashboard",   label:"Dashboard",     icon:LayoutDashboard },
  { id:"entry",       label:"Entry Sheet",   icon:FileText         },
  { id:"items",       label:"Item Master",   icon:Package          },
  { id:"itemimport",  label:"Import Items",  icon:FileSpreadsheet  },
  { id:"consumptionimport", label:"Import Consumptions", icon:FileSpreadsheet },
  { id:"sewaimport", label:"Import Sewa", icon:FileSpreadsheet },
  { id:"batches",     label:"Batch Manager", icon:Layers           },
  { id:"batchimport", label:"Import Batches",icon:FileSpreadsheet  },
  { id:"ledger",      label:"Ledger Master", icon:BookUser         },
  { id:"stockreport", label:"Stock Report",  icon:ClipboardList    },
  { id:"batchledger", label:"Batch Ledger",  icon:BookOpen         },
  { id:"coldstoragereport", label:"Cold Storage Report", icon:Snowflake },
];

export default function App() {
  const [page,     setPage]     = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(false);
  const [highlightEntryId, setHighlightEntryId] = useState(null);

  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Admin data first — events are needed by useInventory for Add/Less calc
  const {
    categories, units, events, users, loginLogs,
    loading: adminLoading, error: adminError, refetch: adminRefetch,
    addCategory, updateCategory, deleteCategory,
    addUnit, updateUnit, deleteUnit,
    addEvent, updateEvent, deleteEvent,
    updateUser,
    addUser,
  } = useAdmin();

  // Live, real-time inventory data — no manual refresh needed anywhere
  const {
    items, batches, ledger, entries, stockMap, batchTxnMap,
    loading, error,
    expiredBatches, expiringBatches, lowStockItems, totalAlerts,
    addItem, updateItem, deleteItem,
    addBatch, updateBatch, deleteBatch,
    addLedger, updateLedger, deleteLedger,
  } = useInventory(events);

  const { addEntry, addEntriesBatch, updateEntry, deleteEntry } = useEntries();

  const navigate = (id) => { setPage(id); setSideOpen(false); };

  // Called from Stock Report when a transaction row is clicked.
  // Switches to Entry Sheet and scrolls/highlights that row.
  const handleViewTransaction = (entryId) => {
    if (!entryId) return;
    setHighlightEntryId(entryId);
    setPage("entry");
    setSideOpen(false);
    // Wait for the page to render, then scroll to the row
    setTimeout(() => {
      const el = document.getElementById(`entry-row-${entryId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-teal-400", "bg-teal-50/60");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-teal-400", "bg-teal-50/60");
        }, 2500);
      }
    }, 150);
  };

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
            <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
              InvenPro · Inventory Management System
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Live
              </span>
            </p>
          </div>

          <AlertBell
            expiringBatches={expiringBatches}
            expiredBatches={expiredBatches}
            lowStockItems={enrichedLowStock}
            itemMap={itemMap}
            onNavigate={navigate}
          />
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

          {!loading && page === "entry" && (
            <EntrySheet
              items={items} batches={batches} stockMap={stockMap} batchTxnMap={batchTxnMap}
              events={events} ledger={ledger}
              entries={entries}
              addEntry={addEntry} updateEntry={updateEntry} deleteEntry={deleteEntry}
            />
          )}

          {!loading && page === "items" && (
            <ItemMaster items={items} stockMap={stockMap}
              addItem={addItem} updateItem={updateItem} deleteItem={deleteItem}
              categories={categories} units={units}/>
          )}
          {!loading && page === "itemimport" && (
            <ItemImport items={items} categories={categories} units={units} addItem={addItem}/>
          )}
          {!loading && page === "consumptionimport" && (
            <ConsumptionImport
              items={items} batches={batches}
              events={events} batchTxnMap={batchTxnMap}
              addEntriesBatch={addEntriesBatch}
            />
          )}
          {!loading && page === "sewaimport" && (
            <SewaImport
              items={items}
              events={events}
              addEntriesBatch={addEntriesBatch}
            />
          )}
          {!loading && page === "batches" && (
            <BatchManager items={items} batches={batches} ledger={ledger} batchTxnMap={batchTxnMap}
              addBatch={addBatch} updateBatch={updateBatch} deleteBatch={deleteBatch}/>
          )}
          {!loading && page === "batchimport" && (
            <BatchImport items={items} batches={batches} ledger={ledger} addBatch={addBatch}/>
          )}
          {!loading && page === "ledger" && (
            <LedgerMaster ledger={ledger}
              addLedger={addLedger} updateLedger={updateLedger} deleteLedger={deleteLedger}/>
          )}

          {!loading && page === "stockreport" && (
            <StockReport
              items={items} batches={batches} entries={entries}
              events={events} ledger={ledger} stockMap={stockMap} batchTxnMap={batchTxnMap}
              onViewTransaction={handleViewTransaction}
            />
          )}

          {!loading && page === "batchledger" && (
            <BatchLedger
              items={items} batches={batches}
              events={events} ledger={ledger} batchTxnMap={batchTxnMap}
            />
          )}

          {!loading && page === "coldstoragereport" && (
            <ColdStorageReport
              items={items} batches={batches} ledger={ledger} batchTxnMap={batchTxnMap}
            />
          )}

          {!loading && page === "admin" && isAdmin && (
            <AdminPanel
              categories={categories} units={units} events={events}
              users={users} loginLogs={loginLogs}
              items={items} stockMap={stockMap}
              loading={adminLoading} error={adminError} refetch={adminRefetch}
              addCategory={addCategory} updateCategory={updateCategory} deleteCategory={deleteCategory}
              addUnit={addUnit} updateUnit={updateUnit} deleteUnit={deleteUnit}
              addEvent={addEvent} updateEvent={updateEvent} deleteEvent={deleteEvent}
              updateUser={updateUser} updateItem={updateItem} addUser={addUser}
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