import { useState } from "react";
import { Plus, Pencil, Trash2, CalendarClock, Search } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Toast, useToast, ConfirmModal, Modal, Field, inputCls, PrimaryBtn, SaveBtn, Empty } from "../components/ui";
import { addLedger as addLedgerFn } from "../firebase/ledger";
import { computeClosingQty } from "../firebase/stock";

const EMPTY = { itemId:"", batchNo:"", expiryDate:"", quantity:"", purchasePrice:"", mrp:"", supplierId:"" };

function ExpiryBadge({ date }) {
  if (!date) return null;
  const d = differenceInDays(date, new Date());
  if (d < 0)   return <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-red-100 text-red-600">EXPIRED</span>;
  if (d <= 7)  return <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-red-100 text-red-600">⚠ {d}d left</span>;
  if (d <= 15) return <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-orange-100 text-orange-600">⚠ {d}d left</span>;
  if (d <= 30) return <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700">{d}d left</span>;
  return <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600">Good</span>;
}

export default function BatchManager({ items, batches, ledger, batchTxnMap, addBatch, updateBatch, deleteBatch }) {
  const [form,           setForm]           = useState(EMPTY);
  const [editId,         setEditId]         = useState(null);
  const [modal,          setModal]          = useState(false);
  const [delId,          setDelId]          = useState(null);
  const [filter,         setFilter]         = useState("all");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [toast,          showToast]         = useToast();
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherName,      setOtherName]      = useState("");
  const [savingOther,    setSavingOther]    = useState(false);
  const [localLedger,    setLocalLedger]    = useState(ledger);
  const [prevLedger,     setPrevLedger]     = useState(ledger);

  if (ledger !== prevLedger && !modal) {
    setPrevLedger(ledger);
    setLocalLedger(ledger);
  }

  const itemMap   = Object.fromEntries(items.map(i => [i.id, i]));
  const ledgerMap = Object.fromEntries(localLedger.map(l => [l.id, l]));

  const openAdd  = () => {
    setForm(EMPTY);
    setEditId(null);
    setShowOtherInput(false);
    setOtherName("");
    setModal(true);
  };

  const openEdit = (b) => {
    setForm({
      itemId: b.itemId, batchNo: b.batchNo || "",
      expiryDate: b.expiryDate ? format(b.expiryDate, "yyyy-MM-dd") : "",
      quantity: b.quantity ?? "", purchasePrice: b.purchasePrice ?? "",
      mrp: b.mrp ?? "", supplierId: b.supplierId || ""
    });
    setShowOtherInput(false);
    setOtherName("");
    setEditId(b.id);
    setModal(true);
  };

  const handleSupplierChange = (val) => {
    if (val === "__other__") {
      setShowOtherInput(true);
      setForm(f => ({ ...f, supplierId: "" }));
    } else {
      setShowOtherInput(false);
      setOtherName("");
      setForm(f => ({ ...f, supplierId: val }));
    }
  };

  const handleSaveOther = async () => {
    if (!otherName.trim()) return;
    setSavingOther(true);
    const nameToSave = otherName.trim();
    try {
      const docRef = await addLedgerFn({
        name: nameToSave, type: "Supplier", phone: "", address: ""
      });
      const newEntry = { id: docRef.id, name: nameToSave, type: "Supplier", phone: "", address: "" };
      setLocalLedger(prev => [newEntry, ...prev]);
      setForm(f => ({ ...f, supplierId: docRef.id }));
      setShowOtherInput(false);
      setOtherName("");
      showToast(`"${nameToSave}" added!`);
    } catch {
      showToast("Error saving supplier", "error");
    } finally {
      setSavingOther(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.itemId || !form.batchNo || !form.expiryDate || !form.quantity) return;
    try {
      if (editId) { await updateBatch(editId, form); showToast("Batch updated!"); }
      else        { await addBatch(form);             showToast("Batch added!");   }
      setModal(false);
    } catch { showToast("Error saving batch", "error"); }
  };

  const handleDelete = async () => {
    await deleteBatch(delId);
    setDelId(null);
    showToast("Batch deleted");
  };

  // Helper function to check if a batch matches the search query
  const matchesSearch = (batch, query) => {
    if (!query.trim()) return true;
    
    const q = query.toLowerCase().trim();
    const item = itemMap[batch.itemId];
    const supplier = ledgerMap[batch.supplierId];
    
    // Get all searchable fields as strings
    const searchableFields = [
      // Item related
      item?.name || "",
      item?.unit || "",
      item?.id || "",
      
      // Batch fields
      batch.batchNo || "",
      batch.id || "",
      
      // Supplier
      supplier?.name || "",
      supplier?.id || "",
      
      // Quantities and prices (converted to string)
      batch.quantity?.toString() || "",
      batch.purchasePrice?.toString() || "",
      batch.mrp?.toString() || "",
      
      // Expiry date (formatted)
      batch.expiryDate ? format(batch.expiryDate, "dd MMM yyyy") : "",
      batch.expiryDate ? format(batch.expiryDate, "yyyy-MM-dd") : "",
      batch.expiryDate ? format(batch.expiryDate, "MMM dd, yyyy") : "",
      
      // Computed fields
      computeClosingQty(batch, batchTxnMap || {})?.toString() || "",
    ];
    
    // Check if any field contains the search query
    return searchableFields.some(field => 
      field.toLowerCase().includes(q)
    );
  };

  // First filter by item, then by search query
  const filteredByItem = batches.filter(b => filter === "all" || b.itemId === filter);
  const list = filteredByItem.filter(b => matchesSearch(b, searchQuery));

  return (
    <div className="space-y-6">
      <Toast toast={toast}/>
      <ConfirmModal open={!!delId} onCancel={()=>setDelId(null)} onConfirm={handleDelete}
        title="Delete Batch?" message="This batch record will be permanently removed."/>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{fontFamily:"'Syne',sans-serif"}}>Batch Manager</h1>
          <p className="text-slate-500 text-sm mt-0.5">{batches.length} batches tracked</p>
        </div>
        <PrimaryBtn onClick={openAdd}><Plus size={15}/>Add Batch</PrimaryBtn>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700">
        💡 <strong>Opening Qty</strong> is what you enter here and never changes. Current stock is calculated live from Entry Sheet transactions — view it in the <strong>Current</strong> column or the <strong>Batch Ledger</strong> report.
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 font-medium shrink-0">Filter:</span>
          <select value={filter} onChange={e=>setFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white max-w-xs">
            <option value="all">All Items</option>
            {items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search anything (name, batch, supplier, qty, price, date...)"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {list.length === 0
          ? <Empty icon={CalendarClock} title="No batches found" sub={searchQuery ? `No results found for "${searchQuery}"` : "Add a batch using the button above"}/>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                    {["#","Item","Batch No.","Expiry","Status","Opening Qty","Current","Purchase ₹","MRP ₹","Supplier","Actions"].map(h=>(
                      <th key={h} className="text-left px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((b, idx) => {
                    const item     = itemMap[b.itemId];
                    const supplier = ledgerMap[b.supplierId];
                    const closing  = computeClosingQty(b, batchTxnMap || {});
                    const changed  = closing !== Number(b.quantity);
                    return (
                      <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{item?.name ?? "—"}</td>
                        <td className="px-5 py-4 font-mono text-teal-700 text-xs">{b.batchNo}</td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{b.expiryDate ? format(b.expiryDate,"dd MMM yyyy") : "—"}</td>
                        <td className="px-5 py-4"><ExpiryBadge date={b.expiryDate}/></td>
                        <td className="px-5 py-4 text-slate-500">
                          {b.quantity} <span className="text-xs">{item?.unit}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`font-bold ${changed ? "text-teal-700" : "text-slate-800"}`}>{closing}</span>
                          <span className="text-slate-400 text-xs ml-1">{item?.unit}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{b.purchasePrice!=null?`₹${b.purchasePrice}`:"—"}</td>
                        <td className="px-5 py-4 text-slate-600">{b.mrp!=null?`₹${b.mrp}`:"—"}</td>
                        <td className="px-5 py-4 text-slate-500">{supplier?.name ?? "—"}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button onClick={()=>openEdit(b)} className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"><Pencil size={14}/></button>
                            <button onClick={()=>setDelId(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title={editId?"Edit Batch":"Add New Batch"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Select Item *">
            <select required value={form.itemId} onChange={e=>setForm({...form,itemId:e.target.value})} className={inputCls}>
              <option value="">— Select Item —</option>
              {items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Batch Number *">
              <input required value={form.batchNo} onChange={e=>setForm({...form,batchNo:e.target.value})}
                placeholder="e.g. B2024-001" className={inputCls}/>
            </Field>
            <Field label="Expiry Date *">
              <input required type="date" value={form.expiryDate}
                onChange={e=>setForm({...form,expiryDate:e.target.value})} className={inputCls}/>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Opening Qty *">
              <input required type="number" min="0" step="0.01" value={form.quantity}
                onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="0" className={inputCls}/>
            </Field>
            <Field label="Purchase ₹">
              <input type="number" min="0" step="0.01" value={form.purchasePrice}
                onChange={e=>setForm({...form,purchasePrice:e.target.value})} placeholder="0.00" className={inputCls}/>
            </Field>
            <Field label="MRP ₹">
              <input type="number" min="0" step="0.01" value={form.mrp}
                onChange={e=>setForm({...form,mrp:e.target.value})} placeholder="0.00" className={inputCls}/>
            </Field>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg -mt-1">
            ⚠ Opening Qty is frozen after creation. To adjust stock later, use the Entry Sheet (Purchase/Sale/Damage etc.) — it never changes this number directly.
          </p>

          <Field label="Supplier">
            <select value={form.supplierId || ""}
              onChange={e => handleSupplierChange(e.target.value)} className={inputCls}>
              <option value="">— Select Supplier —</option>
              {localLedger.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value="__other__">➕ Other (Add New Supplier)</option>
            </select>
          </Field>

          {showOtherInput && (
            <div className="flex gap-2 items-end p-3 bg-teal-50 rounded-xl border border-teal-100">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-teal-700 mb-1.5 uppercase tracking-wide">New Supplier Name</label>
                <input value={otherName} onChange={e=>setOtherName(e.target.value)}
                  placeholder="Enter supplier name…" className={inputCls}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSaveOther(); }}}
                  autoFocus/>
              </div>
              <button type="button" onClick={handleSaveOther} disabled={savingOther || !otherName.trim()}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                {savingOther ? "Saving…" : "Save & Select"}
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={()=>setModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <SaveBtn>{editId?"Update Batch":"Add Batch"}</SaveBtn>
          </div>
        </form>
      </Modal>
    </div>
  );
}