import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, FileText, Calculator } from "lucide-react";
import { Toast, useToast, ConfirmModal, Modal, Field, inputCls, PrimaryBtn, SaveBtn, Empty } from "../components/ui";
import { addBatch as addBatchFn } from "../firebase/batches";
import { addLedger as addLedgerFn } from "../firebase/ledger";

const EMPTY = {
  date: format(new Date(), "yyyy-MM-dd"),
  itemId: "", batchId: "", eventId: "", docNo: "", ledgerId: "",
  qty: "", rate: "", amount: "",
};

const EMPTY_NEW_BATCH = { batchNo: "", expiryDate: "" };

const roundValue = (val, mode) => {
  if (val === "" || val == null || isNaN(val)) return "";
  const num = Number(val);
  return mode === "round" ? Math.round(num).toString() : num.toFixed(2);
};

export default function EntrySheet({ items, batches, stockMap, events, ledger, entries, addEntry, updateEntry, deleteEntry }) {
  const [form,        setForm]        = useState(EMPTY);
  const [editId,      setEditId]      = useState(null);
  const [modal,       setModal]       = useState(false);
  const [delId,       setDelId]       = useState(null);
  const [decimalMode, setDecimalMode] = useState("decimal");
  const [lastEdited,  setLastEdited]  = useState(null);
  const [toast,       showToast]      = useToast();

  // Local batches copy — lets us add a new batch without closing modal
  const [localBatches, setLocalBatches] = useState(batches);
  const [prevBatches,  setPrevBatches]  = useState(batches);
  if (batches !== prevBatches && !modal) {
    setPrevBatches(batches);
    setLocalBatches(batches);
  }

  // Local ledger copy — lets us add a new party without closing modal
  const [localLedger, setLocalLedger] = useState(ledger);
  const [prevLedger,  setPrevLedger]  = useState(ledger);
  if (ledger !== prevLedger && !modal) {
    setPrevLedger(ledger);
    setLocalLedger(ledger);
  }

  // "Other" inline new-batch form
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [newBatch,      setNewBatch]    = useState(EMPTY_NEW_BATCH);
  const [savingBatch,   setSavingBatch] = useState(false);

  // "Other" inline new-ledger form
  const [showNewLedger, setShowNewLedger] = useState(false);
  const [newLedgerName, setNewLedgerName] = useState("");
  const [savingLedger,  setSavingLedger]  = useState(false);

  const activeEvents = events.filter(e => e.active !== false);
  const itemMap   = Object.fromEntries(items.map(i => [i.id, i]));
  const eventMap  = Object.fromEntries(events.map(e => [e.id, e]));
  const ledgerMap = Object.fromEntries(localLedger.map(l => [l.id, l]));

  // Batches available for the currently selected item
  const itemBatches = useMemo(() =>
    localBatches.filter(b => b.itemId === form.itemId),
    [localBatches, form.itemId]
  );

  const openAdd = () => {
    setForm(EMPTY);
    setEditId(null);
    setLastEdited(null);
    setShowNewBatch(false);
    setNewBatch(EMPTY_NEW_BATCH);
    setShowNewLedger(false);
    setNewLedgerName("");
    setModal(true);
  };

  const openEdit = (entry) => {
    setForm({
      date: entry.date ? format(entry.date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      itemId: entry.itemId || "", batchId: entry.batchId || "",
      eventId: entry.eventId || "", docNo: entry.docNo || "", ledgerId: entry.ledgerId || "",
      qty: entry.qty ?? "", rate: entry.rate ?? "", amount: entry.amount ?? "",
    });
    setEditId(entry.id);
    setLastEdited(null);
    setShowNewBatch(false);
    setNewBatch(EMPTY_NEW_BATCH);
    setShowNewLedger(false);
    setNewLedgerName("");
    setModal(true);
  };

  // ── Two-way Qty/Rate/Amount calculation ────────────────────
  const recalc = (field, value, currentForm) => {
    const next = { ...currentForm, [field]: value };
    const qty = Number(next.qty);

    if (field === "qty") {
      if (lastEdited === "amount" && next.amount !== "") {
        const amt = Number(next.amount);
        next.rate = qty > 0 ? roundValue(amt / qty, decimalMode) : "";
      } else if (next.rate !== "") {
        const rate = Number(next.rate);
        next.amount = roundValue(qty * rate, decimalMode);
      }
    }

    if (field === "rate") {
      setLastEdited("rate");
      if (qty > 0 && value !== "") next.amount = roundValue(qty * Number(value), decimalMode);
      else if (value === "") next.amount = "";
    }

    if (field === "amount") {
      setLastEdited("amount");
      if (qty > 0 && value !== "") next.rate = roundValue(Number(value) / qty, decimalMode);
      else if (value === "") next.rate = "";
    }

    return next;
  };

  const handleFieldChange = (field, value) => {
    setForm(prev => recalc(field, value, prev));
  };

  const handleDecimalModeChange = (mode) => {
    setDecimalMode(mode);
    setForm(prev => ({
      ...prev,
      rate:   prev.rate   !== "" ? roundValue(prev.rate, mode)   : "",
      amount: prev.amount !== "" ? roundValue(prev.amount, mode) : "",
    }));
  };

  // ── Item change resets batch selection ─────────────────────
  const handleItemChange = (itemId) => {
    setForm(prev => ({ ...prev, itemId, batchId: "" }));
    setShowNewBatch(false);
    setNewBatch(EMPTY_NEW_BATCH);
  };

  // ── Batch dropdown change ───────────────────────────────────
  const handleBatchChange = (val) => {
    if (val === "__other__") {
      setShowNewBatch(true);
      setForm(f => ({ ...f, batchId: "" }));
    } else {
      setShowNewBatch(false);
      setNewBatch(EMPTY_NEW_BATCH);
      setForm(f => ({ ...f, batchId: val }));
    }
  };

  // ── Save new batch inline (without closing Entry modal) ────
  const handleSaveNewBatch = async () => {
    if (!newBatch.batchNo.trim() || !newBatch.expiryDate) {
      showToast("Batch No and Expiry Date are required", "error");
      return;
    }
    if (!form.itemId) {
      showToast("Select an item first", "error");
      return;
    }
    if (!form.qty) {
      showToast("Enter Qty below first — it will be used as the batch's starting stock", "error");
      return;
    }
    setSavingBatch(true);
    try {
      const docRef = await addBatchFn({
        itemId: form.itemId,
        batchNo: newBatch.batchNo.trim(),
        expiryDate: newBatch.expiryDate,
        quantity: form.qty,
        purchasePrice: "", mrp: "", supplierId: form.ledgerId || "",
      });

      const newEntry = {
        id: docRef.id,
        itemId: form.itemId,
        batchNo: newBatch.batchNo.trim(),
        expiryDate: new Date(newBatch.expiryDate),
        quantity: Number(form.qty),
      };
      setLocalBatches(prev => [newEntry, ...prev]);
      setForm(f => ({ ...f, batchId: docRef.id }));
      setShowNewBatch(false);
      setNewBatch(EMPTY_NEW_BATCH);
      showToast(`Batch "${newBatch.batchNo.trim()}" created!`);
    } catch {
      showToast("Error creating batch", "error");
    } finally {
      setSavingBatch(false);
    }
  };

  // ── Ledger dropdown change ──────────────────────────────────
  const handleLedgerChange = (val) => {
    if (val === "__other__") {
      setShowNewLedger(true);
      setForm(f => ({ ...f, ledgerId: "" }));
    } else {
      setShowNewLedger(false);
      setNewLedgerName("");
      setForm(f => ({ ...f, ledgerId: val }));
    }
  };

  // ── Save new ledger party inline (without closing Entry modal) ──
  const handleSaveNewLedger = async () => {
    const name = newLedgerName.trim();
    if (!name) {
      showToast("Enter a party name", "error");
      return;
    }
    setSavingLedger(true);
    try {
      const docRef = await addLedgerFn({ name, type: "Supplier", phone: "", address: "" });
      const newEntry = { id: docRef.id, name, type: "Supplier", phone: "", address: "" };
      setLocalLedger(prev => [newEntry, ...prev]);
      setForm(f => ({ ...f, ledgerId: docRef.id }));
      setShowNewLedger(false);
      setNewLedgerName("");
      showToast(`"${name}" added to Ledger!`);
    } catch {
      showToast("Error saving party", "error");
    } finally {
      setSavingLedger(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.itemId || !form.eventId || !form.qty || !form.rate) return;
    try {
      if (editId) { await updateEntry(editId, form); showToast("Entry updated!"); }
      else        { await addEntry(form);             showToast("Entry added!");   }
      setModal(false);
    } catch { showToast("Error saving entry", "error"); }
  };

  const handleDelete = async () => { await deleteEntry(delId); setDelId(null); showToast("Entry deleted"); };

  const sortedEntries = useMemo(() =>
    [...entries].sort((a, b) => (b.date || 0) - (a.date || 0)),
    [entries]
  );

  const batchMapForDisplay = Object.fromEntries(localBatches.map(b => [b.id, b]));

  return (
    <div className="space-y-6">
      <Toast toast={toast}/>
      <ConfirmModal open={!!delId} onCancel={()=>setDelId(null)} onConfirm={handleDelete}
        title="Delete Entry?" message="This entry will be permanently removed."/>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{fontFamily:"'Syne',sans-serif"}}>Entry Sheet</h1>
          <p className="text-slate-500 text-sm mt-0.5">{entries.length} entries recorded</p>
        </div>
        <PrimaryBtn onClick={openAdd}><Plus size={15}/>New Entry</PrimaryBtn>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {sortedEntries.length === 0
          ? <Empty icon={FileText} title="No entries yet" sub="Add your first entry using the button above"/>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                    {["#","Date","Item","Batch","Event","Doc/Ref No","Ledger","Qty","Rate","Amount","Actions"].map(h=>(
                      <th key={h} className="text-left px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry, idx) => {
                    const item  = itemMap[entry.itemId];
                    const ev    = eventMap[entry.eventId];
                    const party = ledgerMap[entry.ledgerId];
                    const batch = batchMapForDisplay[entry.batchId];
                    return (
                      <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{entry.date ? format(entry.date, "dd MMM yyyy") : "—"}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{item?.name ?? "—"}</td>
                        <td className="px-5 py-4 font-mono text-teal-700 text-xs">{batch?.batchNo ?? "—"}</td>
                        <td className="px-5 py-4">
                          {ev && (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium
                              ${ev.type === "Add" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                              {ev.name}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-500">{entry.docNo || "—"}</td>
                        <td className="px-5 py-4 text-slate-500">{party?.name ?? "—"}</td>
                        <td className="px-5 py-4 text-slate-700">{entry.qty} {item?.unit}</td>
                        <td className="px-5 py-4 text-slate-700">₹{entry.rate}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">₹{entry.amount}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button onClick={()=>openEdit(entry)} className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"><Pencil size={14}/></button>
                            <button onClick={()=>setDelId(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={14}/></button>
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

      <Modal open={modal} onClose={()=>setModal(false)} title={editId?"Edit Entry":"New Entry"}>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Decimal mode toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-slate-500"/>
              <span className="text-sm font-semibold text-slate-600">Calculation Mode</span>
            </div>
            <div className="flex gap-1 bg-white rounded-lg p-1 border border-slate-200">
              <button type="button" onClick={()=>handleDecimalModeChange("decimal")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors
                  ${decimalMode === "decimal" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                2 Decimal
              </button>
              <button type="button" onClick={()=>handleDecimalModeChange("round")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors
                  ${decimalMode === "round" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                Round Off
              </button>
            </div>
          </div>

          <Field label="Date *">
            <input required type="date" value={form.date}
              onChange={e=>setForm({...form,date:e.target.value})} className={inputCls}/>
          </Field>

          <Field label="Item *">
            <select required value={form.itemId} onChange={e=>handleItemChange(e.target.value)} className={inputCls}>
              <option value="">— Select Item —</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} ({stockMap[i.id] ?? 0} {i.unit} in stock)
                </option>
              ))}
            </select>
          </Field>

          {/* Qty / Rate / Amount — moved above Batch so qty is ready when creating a new batch */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Qty *">
              <input required type="number" min="0" step="0.001" value={form.qty}
                onChange={e=>handleFieldChange("qty", e.target.value)}
                placeholder="0" className={inputCls}/>
            </Field>
            <Field label="Rate *">
              <input type="number" min="0" step="0.01" value={form.rate}
                onChange={e=>handleFieldChange("rate", e.target.value)}
                placeholder="0.00" className={inputCls}/>
            </Field>
            <Field label="Amount *">
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e=>handleFieldChange("amount", e.target.value)}
                placeholder="0.00" className={inputCls}/>
            </Field>
          </div>
          <p className="text-xs text-slate-400 -mt-2">
            💡 Enter Qty + Rate → Amount auto-calculates. Enter Qty + Amount → Rate auto-calculates.
          </p>

          {/* Batch dropdown — only shows once item is selected */}
          {form.itemId && (
            <Field label="Batch">
              <select value={form.batchId} onChange={e=>handleBatchChange(e.target.value)} className={inputCls}>
                <option value="">— Select Batch —</option>
                {itemBatches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batchNo} · Exp: {b.expiryDate ? format(b.expiryDate, "dd MMM yyyy") : "N/A"} · Qty: {b.quantity}
                  </option>
                ))}
                <option value="__other__">➕ Other (Create New Batch)</option>
              </select>
            </Field>
          )}

          {/* Inline new batch creation — qty comes from the Qty field above */}
          {showNewBatch && (
            <div className="p-3 bg-teal-50 rounded-xl border border-teal-100 space-y-3">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Create New Batch</p>
              <div className="grid grid-cols-2 gap-2.5">
                <input value={newBatch.batchNo} onChange={e=>setNewBatch({...newBatch,batchNo:e.target.value})}
                  placeholder="Batch No *" className={inputCls}/>
                <input type="date" value={newBatch.expiryDate} onChange={e=>setNewBatch({...newBatch,expiryDate:e.target.value})}
                  className={inputCls}/>
              </div>
              {form.qty ? (
                <p className="text-xs text-teal-600">
                  Starting stock for this batch will be set to <strong>{form.qty} {itemMap[form.itemId]?.unit}</strong> (from Qty field above)
                </p>
              ) : (
                <p className="text-xs text-red-500">
                  ⚠ Enter Qty above first — it becomes the batch's starting stock
                </p>
              )}
              <button type="button" onClick={handleSaveNewBatch} disabled={savingBatch}
                className="w-full py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
                {savingBatch ? "Creating…" : "Create & Select Batch"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Event *">
              <select required value={form.eventId} onChange={e=>setForm({...form,eventId:e.target.value})} className={inputCls}>
                <option value="">— Select Event —</option>
                {activeEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.type === "Add" ? "+" : "−"})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Doc No / Ref No">
              <input value={form.docNo} onChange={e=>setForm({...form,docNo:e.target.value})}
                placeholder="e.g. INV-001" className={inputCls}/>
            </Field>
          </div>

          <Field label="Ledger Name">
            <select value={form.ledgerId} onChange={e=>handleLedgerChange(e.target.value)} className={inputCls}>
              <option value="">— Select Party —</option>
              {localLedger.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value="__other__">➕ Other (Add New Party)</option>
            </select>
          </Field>

          {/* Inline new ledger party creation */}
          {showNewLedger && (
            <div className="flex gap-2 items-end p-3 bg-teal-50 rounded-xl border border-teal-100">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-teal-700 mb-1.5 uppercase tracking-wide">New Party Name</label>
                <input value={newLedgerName} onChange={e=>setNewLedgerName(e.target.value)}
                  placeholder="Enter supplier/customer name…" className={inputCls}
                  onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); handleSaveNewLedger(); }}}
                  autoFocus/>
              </div>
              <button type="button" onClick={handleSaveNewLedger} disabled={savingLedger || !newLedgerName.trim()}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                {savingLedger ? "Saving…" : "Save & Select"}
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={()=>setModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <SaveBtn>{editId?"Update Entry":"Save Entry"}</SaveBtn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
