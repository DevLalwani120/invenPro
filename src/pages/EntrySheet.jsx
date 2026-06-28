import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, FileText, Calculator, PlusCircle, MinusCircle } from "lucide-react";
import { Toast, useToast, ConfirmModal, Modal, Field, inputCls, PrimaryBtn, SaveBtn, Empty } from "../components/ui";
import { addBatch as addBatchFn } from "../firebase/batches";
import { addLedger as addLedgerFn } from "../firebase/ledger";
import { computeClosingQty } from "../firebase/stock";

const EMPTY_ROW = { itemId: "", batchId: "", qty: "", rate: "", amount: "" };
const EMPTY_HEADER = {
  date: format(new Date(), "yyyy-MM-dd"), eventId: "", docNo: "", ledgerId: "",
  ledgerOtherName: "", ledgerOtherMobile: "", ledgerOtherAddress: "",
};
const EMPTY_NEW_BATCH = { batchNo: "", expiryDate: "" };

const roundValue = (val, mode) => {
  if (val === "" || val == null || isNaN(val)) return "";
  const num = Number(val);
  return mode === "round" ? Math.round(num).toString() : num.toFixed(2);
};

export default function EntrySheet({ items, batches, stockMap, batchTxnMap, events, ledger, entries, addEntry, updateEntry, deleteEntry }) {
  const [header,      setHeader]      = useState(EMPTY_HEADER);
  const [rows,        setRows]        = useState([{ ...EMPTY_ROW }]);
  const [editId,      setEditId]      = useState(null);
  const [modal,       setModal]       = useState(false);
  const [delId,       setDelId]       = useState(null);
  const [decimalMode, setDecimalMode] = useState("decimal");
  const [lastEdited,  setLastEdited]  = useState({});
  const [toast,       showToast]      = useToast();
  const [saving,      setSaving]      = useState(false);

  const [localBatches, setLocalBatches] = useState(batches);
  const [prevBatches,  setPrevBatches]  = useState(batches);
  if (batches !== prevBatches && !modal) { setPrevBatches(batches); setLocalBatches(batches); }

  const [localLedger, setLocalLedger] = useState(ledger);
  const [prevLedger,  setPrevLedger]  = useState(ledger);
  if (ledger !== prevLedger && !modal) { setPrevLedger(ledger); setLocalLedger(ledger); }

  const [showNewLedger, setShowNewLedger] = useState(false);
  const [newLedgerName, setNewLedgerName] = useState("");
  const [savingLedger,  setSavingLedger]  = useState(false);

  const [newBatchRowIdx, setNewBatchRowIdx] = useState(null);
  const [newBatch,        setNewBatch]      = useState(EMPTY_NEW_BATCH);
  const [savingBatch,     setSavingBatch]   = useState(false);

  const activeEvents = events.filter(e => e.active !== false);
  const itemMap   = Object.fromEntries(items.map(i => [i.id, i]));
  const eventMap  = Object.fromEntries(events.map(e => [e.id, e]));
  const ledgerMap = Object.fromEntries(localLedger.map(l => [l.id, l]));

  const selectedEvent = eventMap[header.eventId];
  const isLessEvent   = selectedEvent?.type === "Less";

  const getClosingQty = (batch) => computeClosingQty(batch, batchTxnMap || {});

  const openAdd = () => {
    setHeader(EMPTY_HEADER);
    setRows([{ ...EMPTY_ROW }]);
    setEditId(null);
    setLastEdited({});
    setShowNewLedger(false);
    setNewLedgerName("");
    setNewBatchRowIdx(null);
    setNewBatch(EMPTY_NEW_BATCH);
    setModal(true);
  };

  const openEdit = (entry) => {
    setHeader({
      date: entry.date ? format(entry.date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      eventId: entry.eventId || "", docNo: entry.docNo || "", ledgerId: entry.ledgerId || "",
      ledgerOtherName: entry.ledgerOtherName || "",
      ledgerOtherMobile: entry.ledgerOtherMobile || "",
      ledgerOtherAddress: entry.ledgerOtherAddress || "",
    });
    setRows((entry.rows || []).map(r => ({
      itemId: r.itemId || "", batchId: r.batchId || "",
      qty: r.qty ?? "", rate: r.rate ?? "", amount: r.amount ?? "",
    })));
    setEditId(entry.id);
    setLastEdited({});
    setShowNewLedger(false);
    setNewLedgerName("");
    setNewBatchRowIdx(null);
    setNewBatch(EMPTY_NEW_BATCH);
    setModal(true);
  };

  const addRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }]);

  const removeRow = (idx) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, i) => i !== idx));
    setLastEdited(prev => { const next = { ...prev }; delete next[idx]; return next; });
    if (newBatchRowIdx === idx) { setNewBatchRowIdx(null); setNewBatch(EMPTY_NEW_BATCH); }
  };

  // Rate/Amount are now OPTIONAL — calculation only kicks in if both qty
  // and at least one of rate/amount are present. Saving works fine with
  // just qty (e.g. pure stock movement with no monetary value).
  const recalcRow = (idx, field, value, currentRow) => {
    const next = { ...currentRow, [field]: value };
    const qty = Number(next.qty);

    if (field === "qty") {
      if (lastEdited[idx] === "amount" && next.amount !== "") {
        const amt = Number(next.amount);
        next.rate = qty > 0 ? roundValue(amt / qty, decimalMode) : "";
      } else if (next.rate !== "") {
        next.amount = roundValue(qty * Number(next.rate), decimalMode);
      }
    }
    if (field === "rate") {
      setLastEdited(prev => ({ ...prev, [idx]: "rate" }));
      if (qty > 0 && value !== "") next.amount = roundValue(qty * Number(value), decimalMode);
      else if (value === "") next.amount = "";
    }
    if (field === "amount") {
      setLastEdited(prev => ({ ...prev, [idx]: "amount" }));
      if (qty > 0 && value !== "") next.rate = roundValue(Number(value) / qty, decimalMode);
      else if (value === "") next.rate = "";
    }
    return next;
  };

  const handleRowFieldChange = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => (i === idx ? recalcRow(idx, field, value, r) : r)));
  };

  const handleDecimalModeChange = (mode) => {
    setDecimalMode(mode);
    setRows(prev => prev.map(r => ({
      ...r,
      rate:   r.rate   !== "" ? roundValue(r.rate, mode)   : "",
      amount: r.amount !== "" ? roundValue(r.amount, mode) : "",
    })));
  };

  const handleItemChange = (idx, itemId) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, itemId, batchId: "" } : r)));
    if (newBatchRowIdx === idx) { setNewBatchRowIdx(null); setNewBatch(EMPTY_NEW_BATCH); }
  };

  const handleBatchChange = (idx, val) => {
    if (val === "__other__") {
      setNewBatchRowIdx(idx);
      setNewBatch(EMPTY_NEW_BATCH);
      setRows(prev => prev.map((r, i) => (i === idx ? { ...r, batchId: "" } : r)));
    } else {
      if (newBatchRowIdx === idx) { setNewBatchRowIdx(null); setNewBatch(EMPTY_NEW_BATCH); }
      setRows(prev => prev.map((r, i) => (i === idx ? { ...r, batchId: val } : r)));
    }
  };

  const handleSaveNewBatch = async (idx) => {
    const row = rows[idx];
    if (!newBatch.batchNo.trim() || !newBatch.expiryDate) {
      showToast("Batch No and Expiry Date are required", "error"); return;
    }
    if (!row.itemId) { showToast("Select an item first", "error"); return; }
    if (!row.qty)    { showToast("Enter Qty for this row first — it becomes the batch's opening stock", "error"); return; }

    setSavingBatch(true);
    try {
      const docRef = await addBatchFn({
        itemId: row.itemId,
        batchNo: newBatch.batchNo.trim(),
        expiryDate: newBatch.expiryDate,
        quantity: row.qty,
        purchasePrice: "", mrp: "", supplierId: header.ledgerId || "",
      });
      const newEntry = {
        id: docRef.id, itemId: row.itemId, batchNo: newBatch.batchNo.trim(),
        expiryDate: new Date(newBatch.expiryDate), quantity: Number(row.qty),
      };
      setLocalBatches(prev => [newEntry, ...prev]);
      setRows(prev => prev.map((r, i) => (i === idx ? { ...r, batchId: docRef.id } : r)));
      setNewBatchRowIdx(null);
      setNewBatch(EMPTY_NEW_BATCH);
      showToast(`Batch "${newBatch.batchNo.trim()}" created!`);
    } catch {
      showToast("Error creating batch", "error");
    } finally {
      setSavingBatch(false);
    }
  };

  const handleLedgerChange = (val) => {
    if (val === "__other__") {
      setShowNewLedger(true);
      setHeader(h => ({ ...h, ledgerId: "", ledgerOtherName: "", ledgerOtherMobile: "", ledgerOtherAddress: "" }));
    } else {
      setShowNewLedger(false);
      setNewLedgerName("");
      setHeader(h => ({ ...h, ledgerId: val, ledgerOtherName: "", ledgerOtherMobile: "", ledgerOtherAddress: "" }));
    }
  };

  const handleSaveNewLedger = async () => {
    const name = newLedgerName.trim();
    if (!name) { showToast("Enter a party name", "error"); return; }
    setSavingLedger(true);
    try {
      const docRef = await addLedgerFn({ name, type: "Supplier", phone: "", address: "" });
      const newEntry = { id: docRef.id, name, type: "Supplier", phone: "", address: "" };
      setLocalLedger(prev => [newEntry, ...prev]);
      setHeader(h => ({ ...h, ledgerId: docRef.id }));
      setShowNewLedger(false);
      setNewLedgerName("");
      showToast(`"${name}" added to Ledger!`);
    } catch {
      showToast("Error saving party", "error");
    } finally {
      setSavingLedger(false);
    }
  };

  // Only itemId + qty are mandatory now. Rate/Amount are optional.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!header.eventId) { showToast("Select an Event", "error"); return; }

    const selectedLedgerEntry = ledgerMap[header.ledgerId];
    if (selectedLedgerEntry?.type === "Other" && !header.ledgerOtherName.trim()) {
      showToast(`Enter a name for this ${selectedLedgerEntry.name} transaction`, "error");
      return;
    }

    const validRows = rows.filter(r => r.itemId && r.qty);
    if (validRows.length === 0) { showToast("Add at least one item row with Qty", "error"); return; }

    if (isLessEvent) {
      for (const row of validRows) {
        if (!row.batchId) continue;
        const batch = localBatches.find(b => b.id === row.batchId);
        if (!batch) continue;
        let available = getClosingQty(batch);
        if (editId) {
          const oldEntry = entries.find(en => en.id === editId);
          const oldRow = oldEntry?.rows?.find(r => r.batchId === row.batchId);
          if (oldRow && eventMap[oldEntry.eventId]?.type === "Less") {
            available += Number(oldRow.qty) || 0;
          }
        }
        if (Number(row.qty) > available) {
          showToast(`Not enough stock in batch — available: ${available}, requested: ${row.qty}`, "error");
          return;
        }
      }
    }

    // Normalize rows: rate/amount stay null/"" if never entered (no forced calc)
    const normalizedRows = validRows.map(r => ({
      itemId: r.itemId,
      batchId: r.batchId || "",
      qty: r.qty,
      rate: r.rate === "" ? null : r.rate,
      amount: r.amount === "" ? null : r.amount,
    }));

    setSaving(true);
    try {
      const payload = { ...header, rows: normalizedRows };
      if (editId) { await updateEntry(editId, payload); showToast("Entry updated!"); }
      else        { await addEntry(payload);             showToast("Entry saved!");   }
      setModal(false);
    } catch (err) {
      showToast(err.message || "Error saving entry", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEntry(delId);
      setDelId(null);
      showToast("Entry deleted");
    } catch (err) {
      showToast(err.message || "Error deleting entry", "error");
    }
  };

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => (b.date || 0) - (a.date || 0)), [entries]);
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
                    {["#","Date","Event","Doc/Ref No","Ledger","Items","Total Amount","Actions"].map(h=>(
                      <th key={h} className="text-left px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry, idx) => {
                    const ev    = eventMap[entry.eventId];
                    const party = ledgerMap[entry.ledgerId];
                    const totalAmount = (entry.rows || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                    const hasAnyAmount = (entry.rows || []).some(r => r.amount != null && r.amount !== "");
                    return (
                      <tr key={entry.id}
                        id={`entry-row-${entry.id}`}
                        className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors align-top">
                        <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{entry.date ? format(entry.date, "dd MMM yyyy") : "—"}</td>
                        <td className="px-5 py-4">
                          {ev && (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium
                              ${ev.type === "Add" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                              {ev.name}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-500">{entry.docNo || "—"}</td>
                        <td className="px-5 py-4 text-slate-500">
                          {party?.name ?? "—"}
                          {entry.ledgerOtherName && (
                            <span className="block text-xs text-purple-600 font-medium">
                              {entry.ledgerOtherName}
                              {entry.ledgerOtherMobile && <span className="text-slate-400"> · {entry.ledgerOtherMobile}</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            {(entry.rows || []).map((r, i) => {
                              const item  = itemMap[r.itemId];
                              const batch = batchMapForDisplay[r.batchId];
                              return (
                                <div key={i} className="text-xs text-slate-600">
                                  <span className="font-semibold text-slate-800">{item?.name ?? "—"}</span>
                                  {batch && <span className="font-mono text-teal-700 ml-1">({batch.batchNo})</span>}
                                  <span className="text-slate-400 ml-1">
                                    — {r.qty} {item?.unit}{r.rate != null ? ` @ ₹${r.rate}` : ""}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{hasAnyAmount ? `₹${totalAmount.toFixed(2)}` : "—"}</td>
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

      {/* ── Entry Form Modal — extra wide so item row fits in one line ── */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editId?"Edit Entry":"New Entry"} wide>
        <form onSubmit={handleSubmit} className="space-y-5">

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

          {/* Header — Date, Event, Doc No, Ledger */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date *">
              <input required type="date" value={header.date}
                onChange={e=>setHeader({...header,date:e.target.value})} className={inputCls}/>
            </Field>
            <Field label="Event *">
              <select required value={header.eventId}
                onChange={e=>setHeader({...header,eventId:e.target.value})} className={inputCls}>
                <option value="">— Select Event —</option>
                {activeEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name} ({ev.type === "Add" ? "+" : "−"})</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Doc No / Ref No">
              <input value={header.docNo} onChange={e=>setHeader({...header,docNo:e.target.value})}
                placeholder="e.g. INV-001" className={inputCls}/>
            </Field>
            <Field label="Ledger Name">
              <select value={header.ledgerId} onChange={e=>handleLedgerChange(e.target.value)} className={inputCls}>
                <option value="">— Select Party —</option>
                {localLedger.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value="__other__">➕ Other (Add New Party)</option>
              </select>
            </Field>
          </div>

          {/* Conditional fields — only when selected ledger's type is "Other" */}
          {(() => {
            const selectedLedgerEntry = ledgerMap[header.ledgerId];
            if (selectedLedgerEntry?.type === "Other") {
              return (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                    {selectedLedgerEntry.name} — Details for this transaction
                  </p>
                  <Field label="Name *">
                    <input required value={header.ledgerOtherName}
                      onChange={e=>setHeader({...header, ledgerOtherName: e.target.value})}
                      placeholder="Enter name…" className={inputCls}/>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Mobile">
                      <input value={header.ledgerOtherMobile}
                        onChange={e=>setHeader({...header, ledgerOtherMobile: e.target.value})}
                        placeholder="Mobile number (optional)" className={inputCls}/>
                    </Field>
                    <Field label="Address">
                      <input value={header.ledgerOtherAddress}
                        onChange={e=>setHeader({...header, ledgerOtherAddress: e.target.value})}
                        placeholder="Address (optional)" className={inputCls}/>
                    </Field>
                  </div>
                </div>
              );
            }
            return null;
          })()}

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

          {!header.eventId && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠ Select an Event first — it determines whether you can create new batches below.
            </p>
          )}

          {/* ── Item Rows — single horizontal line ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Rate & Amount optional</span>
                {isLessEvent && (
                  <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                    "Less" — only existing batches
                  </span>
                )}
              </div>
            </div>

            {rows.map((row, idx) => {
              const item = itemMap[row.itemId];
              const itemBatches = localBatches.filter(b => b.itemId === row.itemId);
              const selectedBatch = itemBatches.find(b => b.id === row.batchId);

              let stockWarning = null;
              if (isLessEvent && selectedBatch && row.qty) {
                const available = getClosingQty(selectedBatch);
                if (Number(row.qty) > available) {
                  stockWarning = `Only ${available} ${item?.unit ?? ""} available in this batch`;
                }
              }

              return (
                <div key={idx} className="space-y-2">
                  {/* SINGLE LINE: Item | Qty | Rate | Amount | Batch | + | − */}
                  <div className="flex items-center gap-1.5">
                    <select required value={row.itemId} onChange={e=>handleItemChange(idx, e.target.value)}
                      className="flex-[2] min-w-0 px-2.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                      <option value="">— Item —</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({stockMap[i.id] ?? 0} {i.unit})
                        </option>
                      ))}
                    </select>

                    <input required type="number" min="0" step="0.001" value={row.qty}
                      onChange={e=>handleRowFieldChange(idx, "qty", e.target.value)}
                      placeholder="Qty"
                      className="w-16 px-2 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"/>

                    <input type="number" min="0" step="0.01" value={row.rate}
                      onChange={e=>handleRowFieldChange(idx, "rate", e.target.value)}
                      placeholder="Rate"
                      className="w-20 px-2 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"/>

                    <input type="number" min="0" step="0.01" value={row.amount}
                      onChange={e=>handleRowFieldChange(idx, "amount", e.target.value)}
                      placeholder="Amount"
                      className="w-24 px-2 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"/>

                    {row.itemId && header.eventId ? (
                      <select value={row.batchId} onChange={e=>handleBatchChange(idx, e.target.value)}
                        className="flex-[1.3] min-w-0 px-2 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                        <option value="">— Batch —</option>
                        {itemBatches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.batchNo} · {getClosingQty(b)}
                          </option>
                        ))}
                        {!isLessEvent && <option value="__other__">➕ New</option>}
                      </select>
                    ) : (
                      <div className="flex-[1.3] min-w-0"/>
                    )}

                    <button type="button" onClick={addRow}
                      className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-600 transition-colors shrink-0" title="Add row">
                      <PlusCircle size={17}/>
                    </button>
                    <button type="button" onClick={()=>removeRow(idx)} disabled={rows.length === 1}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0" title="Remove row">
                      <MinusCircle size={17}/>
                    </button>
                  </div>

                  {stockWarning && (
                    <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">⚠ {stockWarning}</p>
                  )}

                  {newBatchRowIdx === idx && (
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-100 space-y-2.5 ml-1">
                      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Create New Batch</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <input value={newBatch.batchNo} onChange={e=>setNewBatch({...newBatch,batchNo:e.target.value})}
                          placeholder="Batch No *" className={inputCls}/>
                        <input type="date" value={newBatch.expiryDate} onChange={e=>setNewBatch({...newBatch,expiryDate:e.target.value})}
                          className={inputCls}/>
                      </div>
                      {row.qty ? (
                        <p className="text-xs text-teal-600">
                          Opening stock will be set to <strong>{row.qty} {item?.unit}</strong> (from Qty above)
                        </p>
                      ) : (
                        <p className="text-xs text-red-500">⚠ Enter Qty above first</p>
                      )}
                      <button type="button" onClick={()=>handleSaveNewBatch(idx)} disabled={savingBatch}
                        className="w-full py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
                        {savingBatch ? "Creating…" : "Create & Select Batch"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={()=>setModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <SaveBtn>{saving ? "Saving…" : editId ? "Update Entry" : "Save Entry"}</SaveBtn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
