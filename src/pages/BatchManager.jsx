import { useState } from "react";
import { Plus, Pencil, Trash2, CalendarClock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Toast, useToast, ConfirmModal, Modal, Field, inputCls, PrimaryBtn, SaveBtn, Empty } from "../components/ui";

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

export default function BatchManager({ items, batches, ledger, addBatch, updateBatch, deleteBatch, addLedger }) {
  const [form,          setForm]          = useState(EMPTY);
  const [editId,        setEditId]        = useState(null);
  const [modal,         setModal]         = useState(false);
  const [delId,         setDelId]         = useState(null);
  const [filter,        setFilter]        = useState("all");
  const [toast,         showToast]        = useToast();

  // "Other" supplier inline entry
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherName,      setOtherName]      = useState("");
  const [savingOther,    setSavingOther]    = useState(false);

  const itemMap     = Object.fromEntries(items.map(i  => [i.id,  i]));
  const ledgerMap   = Object.fromEntries(ledger.map(l => [l.id,  l]));

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setShowOtherInput(false); setOtherName(""); setModal(true); };
  const openEdit = (b) => {
    setForm({ itemId:b.itemId, batchNo:b.batchNo||"",
      expiryDate: b.expiryDate ? format(b.expiryDate,"yyyy-MM-dd") : "",
      quantity:b.quantity??"", purchasePrice:b.purchasePrice??"",
      mrp:b.mrp??"", supplierId:b.supplierId||"" });
    setShowOtherInput(false); setOtherName(""); setEditId(b.id); setModal(true);
  };

  // When user picks "other" from dropdown
  const handleSupplierChange = (val) => {
    if (val === "__other__") {
      setShowOtherInput(true);
      setForm(f => ({ ...f, supplierId: "__other__" }));
    } else {
      setShowOtherInput(false);
      setOtherName("");
      setForm(f => ({ ...f, supplierId: val }));
    }
  };

  // Save new supplier to ledger and auto-select it
  const handleSaveOther = async () => {
    if (!otherName.trim()) return;
    setSavingOther(true);
    try {
      const ref = await addLedger({ name: otherName.trim(), type: "Supplier", phone: "", address: "" });
      // addLedger triggers refetch; we need the new id — use optimistic approach
      // The new entry will appear in ledger on next render; select by name match for now
      showToast(`Supplier "${otherName.trim()}" saved to Ledger!`);
      setShowOtherInput(false);
      setOtherName("");
      // set a sentinel so on next render we can auto-select
      setForm(f => ({ ...f, supplierId: "__pending__", _pendingName: otherName.trim() }));
    } catch {
      showToast("Error saving supplier","error");
    } finally {
      setSavingOther(false);
    }
  };

  // Auto-select newly added supplier once ledger refreshes
  // If supplierId is __pending__ and we find the name, update it
  const resolvedForm = { ...form };
  if (form.supplierId === "__pending__" && form._pendingName) {
    const found = ledger.find(l => l.name === form._pendingName);
    if (found) resolvedForm.supplierId = found.id;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submitForm = { ...resolvedForm };
    delete submitForm._pendingName;
    if (submitForm.supplierId === "__pending__" || submitForm.supplierId === "__other__") {
      submitForm.supplierId = "";
    }
    if (!submitForm.itemId || !submitForm.batchNo || !submitForm.expiryDate || !submitForm.quantity) return;
    try {
      if (editId) { await updateBatch(editId, submitForm); showToast("Batch updated!"); }
      else        { await addBatch(submitForm);             showToast("Batch added!");   }
      setModal(false);
    } catch { showToast("Error saving batch","error"); }
  };

  const handleDelete = async () => { await deleteBatch(delId); setDelId(null); showToast("Batch deleted"); };
  const list = batches.filter(b => filter === "all" || b.itemId === filter);

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

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 font-medium shrink-0">Filter:</span>
        <select value={filter} onChange={e=>setFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white max-w-xs">
          <option value="all">All Items</option>
          {items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {list.length === 0
          ? <Empty icon={CalendarClock} title="No batches found" sub="Add a batch using the button above"/>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                    {["#","Item","Batch No.","Expiry","Status","Qty","Purchase ₹","MRP ₹","Supplier","Actions"].map(h=>(
                      <th key={h} className="text-left px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((b, idx) => {
                    const item     = itemMap[b.itemId];
                    const supplier = ledgerMap[b.supplierId];
                    return (
                      <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{item?.name ?? "—"}</td>
                        <td className="px-5 py-4 font-mono text-teal-700 text-xs">{b.batchNo}</td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{b.expiryDate ? format(b.expiryDate,"dd MMM yyyy") : "—"}</td>
                        <td className="px-5 py-4"><ExpiryBadge date={b.expiryDate}/></td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-slate-800">{b.quantity}</span>
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
            <select required value={resolvedForm.itemId} onChange={e=>setForm({...form,itemId:e.target.value})} className={inputCls}>
              <option value="">— Select Item —</option>
              {items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Batch Number *">
              <input required value={resolvedForm.batchNo} onChange={e=>setForm({...form,batchNo:e.target.value})}
                placeholder="e.g. B2024-001" className={inputCls}/>
            </Field>
            <Field label="Expiry Date *">
              <input required type="date" value={resolvedForm.expiryDate}
                onChange={e=>setForm({...form,expiryDate:e.target.value})} className={inputCls}/>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Quantity *">
              <input required type="number" min="0" value={resolvedForm.quantity}
                onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="0" className={inputCls}/>
            </Field>
            <Field label="Purchase ₹">
              <input type="number" min="0" step="0.01" value={resolvedForm.purchasePrice}
                onChange={e=>setForm({...form,purchasePrice:e.target.value})} placeholder="0.00" className={inputCls}/>
            </Field>
            <Field label="MRP ₹">
              <input type="number" min="0" step="0.01" value={resolvedForm.mrp}
                onChange={e=>setForm({...form,mrp:e.target.value})} placeholder="0.00" className={inputCls}/>
            </Field>
          </div>

          {/* Supplier dropdown from Ledger */}
          <Field label="Supplier">
            <select value={resolvedForm.supplierId === "__pending__" ? "" : (resolvedForm.supplierId || "")}
              onChange={e => handleSupplierChange(e.target.value)} className={inputCls}>
              <option value="">— Select Supplier —</option>
              {ledger.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value="__other__">➕ Other (Add New Supplier)</option>
            </select>
          </Field>

          {/* Inline "Other" input */}
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
