import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, FileText, Calculator, PlusCircle, MinusCircle, AlertTriangle } from "lucide-react";
import { Toast, useToast, ConfirmModal, Modal, Field, inputCls, PrimaryBtn, SaveBtn, Empty } from "../components/ui";
import { addBatch as addBatchFn } from "../firebase/batches";
import { addLedger as addLedgerFn } from "../firebase/ledger";
import { computeClosingQty } from "../firebase/stock";

const EMPTY_ROW    = { itemId:"", batchId:"", qty:"", rate:"", amount:"" };
const EMPTY_HEADER = { date:format(new Date(),"yyyy-MM-dd"), eventId:"", docNo:"", ledgerId:"", ledgerOtherName:"", ledgerOtherMobile:"", ledgerOtherAddress:"" };
const EMPTY_BATCH  = { batchNo:"", expiryDate:"" };

const round = (val, mode) => {
  if (val===""||val==null||isNaN(val)) return "";
  return mode==="round" ? Math.round(Number(val)).toString() : Number(val).toFixed(2);
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

  // Keep local copies so inline batch/ledger creation doesn't close modal
  const [localBatches, setLocalBatches] = useState(batches||[]);
  const [prevBatches,  setPrevBatches]  = useState(batches||[]);
  if (batches !== prevBatches && !modal) { setPrevBatches(batches); setLocalBatches(batches||[]); }

  const [localLedger, setLocalLedger] = useState(ledger||[]);
  const [prevLedger,  setPrevLedger]  = useState(ledger||[]);
  if (ledger !== prevLedger && !modal) { setPrevLedger(ledger); setLocalLedger(ledger||[]); }

  const [showNewLedger, setShowNewLedger] = useState(false);
  const [newLedgerName, setNewLedgerName] = useState("");
  const [savingLedger,  setSavingLedger]  = useState(false);

  const [newBatchRowIdx, setNewBatchRowIdx] = useState(null);
  const [newBatch,        setNewBatch]      = useState(EMPTY_BATCH);
  const [savingBatch,     setSavingBatch]   = useState(false);

  const activeEvents = (events||[]).filter(e => e.active !== false);
  const itemMap   = Object.fromEntries((items||[]).map(i => [i.id, i]));
  const eventMap  = Object.fromEntries((events||[]).map(e => [e.id, e]));
  const ledgerMap = Object.fromEntries(localLedger.map(l => [l.id, l]));

  const selectedEvent = eventMap[header.eventId];
  const isLessEvent   = selectedEvent?.type === "Less";

  const getClosingQty = (batch) => computeClosingQty(batch, batchTxnMap || {});

  // ── Open modals ────────────────────────────────────────────
  const openAdd = () => {
    setHeader(EMPTY_HEADER);
    setRows([{ ...EMPTY_ROW }]);
    setEditId(null); setLastEdited({});
    setShowNewLedger(false); setNewLedgerName("");
    setNewBatchRowIdx(null); setNewBatch(EMPTY_BATCH);
    setModal(true);
  };

  const openEdit = (entry) => {
    setHeader({
      date: entry.date ? format(entry.date,"yyyy-MM-dd") : format(new Date(),"yyyy-MM-dd"),
      eventId: entry.eventId||"", docNo: entry.docNo||"", ledgerId: entry.ledgerId||"",
      ledgerOtherName: entry.ledgerOtherName||"",
      ledgerOtherMobile: entry.ledgerOtherMobile||"",
      ledgerOtherAddress: entry.ledgerOtherAddress||"",
    });
    setRows((entry.rows||[]).map(r => ({
      itemId: r.itemId||"", batchId: r.batchId||"",
      qty: r.qty??"", rate: r.rate??"", amount: r.amount??"",
    })));
    setEditId(entry.id); setLastEdited({});
    setShowNewLedger(false); setNewLedgerName("");
    setNewBatchRowIdx(null); setNewBatch(EMPTY_BATCH);
    setModal(true);
  };

  // ── Row management ─────────────────────────────────────────
  const addRow    = ()    => setRows(prev => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (idx) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_,i) => i !== idx));
    setLastEdited(prev => { const n={...prev}; delete n[idx]; return n; });
    if (newBatchRowIdx === idx) { setNewBatchRowIdx(null); setNewBatch(EMPTY_BATCH); }
  };

  // ── Two-way rate/amount calculation ────────────────────────
  const recalcRow = (idx, field, value, cur) => {
    const next = { ...cur, [field]: value };
    const qty  = Number(next.qty);

    if (field === "qty") {
      if (lastEdited[idx]==="amount" && next.amount!=="") {
        next.rate = qty>0 ? round(Number(next.amount)/qty, decimalMode) : "";
      } else if (next.rate!=="") {
        next.amount = round(qty*Number(next.rate), decimalMode);
      }
    }
    if (field === "rate") {
      setLastEdited(p => ({...p,[idx]:"rate"}));
      next.amount = qty>0&&value!=="" ? round(qty*Number(value),decimalMode) : value===""?"":"";
    }
    if (field === "amount") {
      setLastEdited(p => ({...p,[idx]:"amount"}));
      next.rate = qty>0&&value!=="" ? round(Number(value)/qty,decimalMode) : value===""?"":"";
    }
    return next;
  };

  const handleRowField = (idx, field, value) =>
    setRows(prev => prev.map((r,i) => i===idx ? recalcRow(idx,field,value,r) : r));

  const handleDecimalMode = (mode) => {
    setDecimalMode(mode);
    setRows(prev => prev.map(r => ({
      ...r,
      rate:   r.rate!=""  ? round(r.rate,mode)   : "",
      amount: r.amount!="" ? round(r.amount,mode) : "",
    })));
  };

  const handleItemChange = (idx, itemId) => {
    setRows(prev => prev.map((r,i) => i===idx ? {...r,itemId,batchId:""} : r));
    if (newBatchRowIdx===idx) { setNewBatchRowIdx(null); setNewBatch(EMPTY_BATCH); }
  };

  // ── Batch selection ────────────────────────────────────────
  const handleBatchChange = (idx, val) => {
    if (val === "__other__") {
      setNewBatchRowIdx(idx); setNewBatch(EMPTY_BATCH);
      setRows(prev => prev.map((r,i) => i===idx ? {...r,batchId:""} : r));
    } else {
      if (newBatchRowIdx===idx) { setNewBatchRowIdx(null); setNewBatch(EMPTY_BATCH); }
      setRows(prev => prev.map((r,i) => i===idx ? {...r,batchId:val} : r));
    }
  };

  const handleSaveNewBatch = async (idx) => {
    const row = rows[idx];
    if (!newBatch.batchNo.trim() || !newBatch.expiryDate) {
      showToast("Batch No and Expiry Date are required","error"); return;
    }
    if (!row.itemId) { showToast("Select an item first","error"); return; }
    if (!row.qty)    { showToast("Enter Qty first — it becomes the batch's opening stock","error"); return; }
    setSavingBatch(true);
    try {
      const docRef = await addBatchFn({
        itemId: row.itemId, batchNo: newBatch.batchNo.trim(),
        expiryDate: newBatch.expiryDate, quantity: row.qty,
        purchasePrice:"", mrp:"", supplierId: header.ledgerId||"",
      });
      const newEntry = {
        id:docRef.id, itemId:row.itemId, batchNo:newBatch.batchNo.trim(),
        expiryDate:new Date(newBatch.expiryDate), quantity:Number(row.qty),
      };
      setLocalBatches(prev => [newEntry,...prev]);
      setRows(prev => prev.map((r,i) => i===idx ? {...r,batchId:docRef.id} : r));
      setNewBatchRowIdx(null); setNewBatch(EMPTY_BATCH);
      showToast(`Batch "${newBatch.batchNo.trim()}" created!`);
    } catch { showToast("Error creating batch","error"); }
    finally   { setSavingBatch(false); }
  };

  // ── Ledger ─────────────────────────────────────────────────
  const handleLedgerChange = (val) => {
    if (val==="__other__") {
      setShowNewLedger(true);
      setHeader(h => ({...h,ledgerId:"",ledgerOtherName:"",ledgerOtherMobile:"",ledgerOtherAddress:""}));
    } else {
      setShowNewLedger(false); setNewLedgerName("");
      setHeader(h => ({...h,ledgerId:val,ledgerOtherName:"",ledgerOtherMobile:"",ledgerOtherAddress:""}));
    }
  };

  const handleSaveNewLedger = async () => {
    const name = newLedgerName.trim();
    if (!name) { showToast("Enter a party name","error"); return; }
    setSavingLedger(true);
    try {
      const docRef = await addLedgerFn({name,type:"Supplier",phone:"",address:""});
      const newEntry = {id:docRef.id,name,type:"Supplier",phone:"",address:""};
      setLocalLedger(prev => [newEntry,...prev]);
      setHeader(h => ({...h,ledgerId:docRef.id}));
      setShowNewLedger(false); setNewLedgerName("");
      showToast(`"${name}" added to Ledger!`);
    } catch { showToast("Error saving party","error"); }
    finally   { setSavingLedger(false); }
  };

  // ── Submit with HARD stock validation ─────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!header.eventId) { showToast("Select an Event","error"); return; }

    // Ledger "Other" type check
    const selLedger = ledgerMap[header.ledgerId];
    if (selLedger?.type==="Other" && !header.ledgerOtherName.trim()) {
      showToast(`Enter a name for this ${selLedger.name} transaction`,"error"); return;
    }

    const validRows = rows.filter(r => r.itemId && r.qty);
    if (validRows.length===0) { showToast("Add at least one item row with Qty","error"); return; }

    // ── HARD validation for Less events ─────────────────────
    if (isLessEvent) {
      for (const row of validRows) {
        // Must have a batch selected for Less events
        if (!row.batchId) {
          const item = itemMap[row.itemId];
          showToast(`Select a batch for "${item?.name||"item"}" — required for Less events`,"error");
          return;
        }
        const batch = localBatches.find(b => b.id===row.batchId);
        if (!batch) continue;

        // Compute available stock. If editing, add back this row's old effect first
        let available = getClosingQty(batch);
        if (editId) {
          const oldEntry = (entries||[]).find(en => en.id===editId);
          const oldRow   = oldEntry?.rows?.find(r => r.batchId===row.batchId);
          if (oldRow && eventMap[oldEntry?.eventId]?.type==="Less") {
            available += Number(oldRow.qty)||0;
          }
        }

        if (Number(row.qty) > available) {
          const item = itemMap[row.itemId];
          showToast(
            `Not enough stock in batch "${batch.batchNo}" for "${item?.name||"item"}" — Available: ${available} ${item?.unit||""}, Requested: ${row.qty}`,
            "error"
          );
          return;
        }
      }
    }

    const normalizedRows = validRows.map(r => ({
      itemId:  r.itemId,
      batchId: r.batchId||"",
      qty:     r.qty,
      rate:    r.rate===""   ? null : r.rate,
      amount:  r.amount==="" ? null : r.amount,
    }));

    setSaving(true);
    try {
      const payload = {...header, rows:normalizedRows};
      if (editId) { await updateEntry(editId,payload); showToast("Entry updated!"); }
      else        { await addEntry(payload);            showToast("Entry saved!");   }
      setModal(false);
    } catch (err) {
      showToast(err.message||"Error saving entry","error");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteEntry(delId); setDelId(null); showToast("Entry deleted"); }
    catch (err) { showToast(err.message||"Error deleting entry","error"); }
  };

  const sortedEntries = useMemo(() =>
    [...(entries||[])].sort((a,b) => (b.date||0)-(a.date||0)), [entries]);
  const batchDisplay  = Object.fromEntries(localBatches.map(b => [b.id, b]));

  return (
    <div className="space-y-6">
      <Toast toast={toast}/>
      <ConfirmModal open={!!delId} onCancel={()=>setDelId(null)} onConfirm={handleDelete}
        title="Delete Entry?" message="This entry will be permanently removed."/>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{fontFamily:"'Syne',sans-serif"}}>Entry Sheet</h1>
          <p className="text-slate-500 text-sm mt-0.5">{(entries||[]).length} entries recorded</p>
        </div>
        <PrimaryBtn onClick={openAdd}><Plus size={15}/>New Entry</PrimaryBtn>
      </div>

      {/* Entries table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {sortedEntries.length===0
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
                  {sortedEntries.map((entry,idx) => {
                    const ev    = eventMap[entry.eventId];
                    const party = ledgerMap[entry.ledgerId];
                    const totalAmt = (entry.rows||[]).reduce((s,r)=>s+(Number(r.amount)||0),0);
                    const hasAmt   = (entry.rows||[]).some(r=>r.amount!=null&&r.amount!=="");
                    return (
                      <tr key={entry.id} id={`entry-row-${entry.id}`}
                        className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors align-top">
                        <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                          {entry.date ? format(entry.date,"dd MMM yyyy") : "—"}
                        </td>
                        <td className="px-5 py-4">
                          {ev && (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium
                              ${ev.type==="Add"?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-700"}`}>
                              {ev.name}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-500">{entry.docNo||"—"}</td>
                        <td className="px-5 py-4 text-slate-500">
                          {party?.name??("—")}
                          {entry.ledgerOtherName && (
                            <span className="block text-xs text-purple-600 font-medium">
                              {entry.ledgerOtherName}
                              {entry.ledgerOtherMobile && <span className="text-slate-400"> · {entry.ledgerOtherMobile}</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            {(entry.rows||[]).map((r,i) => {
                              const item  = itemMap[r.itemId];
                              const batch = batchDisplay[r.batchId];
                              return (
                                <div key={i} className="text-xs text-slate-600">
                                  <span className="font-semibold text-slate-800">{item?.name??"—"}</span>
                                  {batch && <span className="font-mono text-teal-700 ml-1">({batch.batchNo})</span>}
                                  <span className="text-slate-400 ml-1">
                                    — {r.qty} {item?.unit}{r.rate!=null?` @ ₹${r.rate}`:""}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-800">
                          {hasAmt ? `₹${totalAmt.toFixed(2)}` : "—"}
                        </td>
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

      {/* ── Entry Modal ── */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editId?"Edit Entry":"New Entry"} wide>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Decimal mode toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-slate-500"/>
              <span className="text-sm font-semibold text-slate-600">Calculation Mode</span>
            </div>
            <div className="flex gap-1 bg-white rounded-lg p-1 border border-slate-200">
              {["decimal","round"].map(m => (
                <button key={m} type="button" onClick={()=>handleDecimalMode(m)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors
                    ${decimalMode===m?"bg-teal-600 text-white":"text-slate-500 hover:bg-slate-50"}`}>
                  {m==="decimal"?"2 Decimal":"Round Off"}
                </button>
              ))}
            </div>
          </div>

          {/* Header fields */}
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
                  <option key={ev.id} value={ev.id}>{ev.name} ({ev.type==="Add"?"+":"−"})</option>
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
                {localLedger.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                <option value="__other__">➕ Other (Add New Party)</option>
              </select>
            </Field>
          </div>

          {showNewLedger && (
            <div className="flex gap-2 items-end p-3 bg-teal-50 rounded-xl border border-teal-100">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-teal-700 mb-1.5 uppercase tracking-wide">New Party Name</label>
                <input value={newLedgerName} onChange={e=>setNewLedgerName(e.target.value)}
                  placeholder="Enter party name…" className={inputCls}
                  onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); handleSaveNewLedger(); }}}
                  autoFocus/>
              </div>
              <button type="button" onClick={handleSaveNewLedger} disabled={savingLedger||!newLedgerName.trim()}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap">
                {savingLedger?"Saving…":"Save & Select"}
              </button>
            </div>
          )}

          {/* "Other" ledger → Name / Mobile / Address */}
          {ledgerMap[header.ledgerId]?.type==="Other" && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                {ledgerMap[header.ledgerId].name} — Details for this transaction
              </p>
              <Field label="Name *">
                <input required value={header.ledgerOtherName}
                  onChange={e=>setHeader({...header,ledgerOtherName:e.target.value})}
                  placeholder="Enter name…" className={inputCls}/>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile">
                  <input value={header.ledgerOtherMobile}
                    onChange={e=>setHeader({...header,ledgerOtherMobile:e.target.value})}
                    placeholder="Optional" className={inputCls}/>
                </Field>
                <Field label="Address">
                  <input value={header.ledgerOtherAddress}
                    onChange={e=>setHeader({...header,ledgerOtherAddress:e.target.value})}
                    placeholder="Optional" className={inputCls}/>
                </Field>
              </div>
            </div>
          )}

          {!header.eventId && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠ Select an Event first — this determines whether new batches can be created.
            </p>
          )}

          {/* Less event notice */}
          {isLessEvent && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertTriangle size={13}/>
              Less event — batch selection is mandatory. Stock will be validated before saving.
            </p>
          )}

          {/* ── Item rows — single horizontal line ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</p>
              <span className="text-xs text-slate-400">Rate &amp; Amount are optional</span>
            </div>

            {rows.map((row, idx) => {
              const item        = itemMap[row.itemId];
              const itemBatches = localBatches.filter(b => b.itemId===row.itemId);
              const selBatch    = itemBatches.find(b => b.id===row.batchId);

              // Live stock warning — show before submit so user knows immediately
              let stockWarning = null;
              if (isLessEvent && selBatch && row.qty) {
                const available = getClosingQty(selBatch);
                if (Number(row.qty) > available) {
                  stockWarning = `Only ${available} ${item?.unit??""} available in batch "${selBatch.batchNo}"`;
                }
              }

              return (
                <div key={idx} className="space-y-2">
                  {/* ── Single horizontal row: Item | Batch | Qty | Rate | Amount | + | − ── */}
                  <div className="flex items-center gap-1.5">

                    {/* Item selector */}
                    <select required value={row.itemId} onChange={e=>handleItemChange(idx,e.target.value)}
                      className="flex-[2] min-w-0 px-2.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                      <option value="">— Item —</option>
                      {(items||[]).map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({(stockMap||{})[i.id]??0} {i.unit})
                        </option>
                      ))}
                    </select>

                    {/* Batch selector — right after item, BEFORE qty, so user sees stock first */}
                    {row.itemId && header.eventId ? (
                      <select value={row.batchId} onChange={e=>handleBatchChange(idx,e.target.value)}
                        className={`flex-[1.5] min-w-0 px-2 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white
                          ${isLessEvent && !row.batchId ? "border-red-300 bg-red-50/30" : "border-slate-200"}`}>
                        <option value="">— Batch{isLessEvent?" (required)":""} —</option>
                        {itemBatches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.batchNo} · {getClosingQty(b)} {item?.unit}
                          </option>
                        ))}
                        {!isLessEvent && <option value="__other__">➕ New Batch</option>}
                      </select>
                    ) : (
                      <div className="flex-[1.5] min-w-0 px-2 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-400 flex items-center">
                        {!header.eventId ? "Select event first" : "Select item first"}
                      </div>
                    )}

                    {/* Qty */}
                    <input required type="number" min="0" step="0.001" value={row.qty}
                      onChange={e=>handleRowField(idx,"qty",e.target.value)}
                      placeholder="Qty"
                      className="w-16 px-2 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"/>

                    {/* Rate */}
                    <input type="number" min="0" step="0.01" value={row.rate}
                      onChange={e=>handleRowField(idx,"rate",e.target.value)}
                      placeholder="Rate"
                      className="w-20 px-2 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"/>

                    {/* Amount */}
                    <input type="number" min="0" step="0.01" value={row.amount}
                      onChange={e=>handleRowField(idx,"amount",e.target.value)}
                      placeholder="Amt"
                      className="w-24 px-2 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"/>

                    {/* Add/Remove row buttons */}
                    <button type="button" onClick={addRow}
                      className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-600 transition-colors shrink-0">
                      <PlusCircle size={17}/>
                    </button>
                    <button type="button" onClick={()=>removeRow(idx)} disabled={rows.length===1}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0">
                      <MinusCircle size={17}/>
                    </button>
                  </div>

                  {/* Live stock warning */}
                  {stockWarning && (
                    <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
                      <AlertTriangle size={12}/> {stockWarning}
                    </p>
                  )}

                  {/* Inline new batch creation (Add events only) */}
                  {newBatchRowIdx===idx && (
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-100 space-y-2.5 ml-1">
                      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Create New Batch</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <input value={newBatch.batchNo} onChange={e=>setNewBatch({...newBatch,batchNo:e.target.value})}
                          placeholder="Batch No *" className={inputCls}/>
                        <input type="date" value={newBatch.expiryDate}
                          onChange={e=>setNewBatch({...newBatch,expiryDate:e.target.value})} className={inputCls}/>
                      </div>
                      {row.qty
                        ? <p className="text-xs text-teal-600">Opening stock will be <strong>{row.qty} {item?.unit}</strong> (from Qty above)</p>
                        : <p className="text-xs text-red-500">⚠ Enter Qty above first</p>
                      }
                      <button type="button" onClick={()=>handleSaveNewBatch(idx)} disabled={savingBatch}
                        className="w-full py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
                        {savingBatch?"Creating…":"Create & Select Batch"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={()=>setModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <SaveBtn>{saving?"Saving…":editId?"Update Entry":"Save Entry"}</SaveBtn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
