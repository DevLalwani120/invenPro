import { useState } from "react";
import { Plus, Pencil, Trash2, BookUser } from "lucide-react";
import { Toast, useToast, ConfirmModal, Modal, Field, inputCls, PrimaryBtn, SaveBtn, Empty } from "../components/ui";

const TYPES = ["Supplier","Customer","Both"];
const EMPTY = { name:"", type:"Supplier", phone:"", address:"", gstin:"" };

export default function LedgerMaster({ ledger, addLedger, updateLedger, deleteLedger }) {
  const [form,   setForm]   = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [modal,  setModal]  = useState(false);
  const [delId,  setDelId]  = useState(null);
  const [search, setSearch] = useState("");
  const [toast,  showToast] = useToast();

  const openAdd  = ()      => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (entry) => {
    setForm({ name:entry.name||"", type:entry.type||"Supplier",
      phone:entry.phone||"", address:entry.address||"", gstin:entry.gstin||"" });
    setEditId(entry.id); setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (editId) { await updateLedger(editId, form); showToast("Entry updated!"); }
      else        { await addLedger(form);             showToast("Entry added!");   }
      setModal(false);
    } catch { showToast("Error saving entry","error"); }
  };

  const handleDelete = async () => { await deleteLedger(delId); setDelId(null); showToast("Entry deleted"); };

  const filtered = ledger.filter(l =>
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.type?.toLowerCase().includes(search.toLowerCase())
  );

  const typeBadge = (type) => {
    const styles = {
      Supplier: "bg-blue-50 text-blue-700",
      Customer: "bg-purple-50 text-purple-700",
      Both:     "bg-teal-50 text-teal-700",
    };
    return <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${styles[type] || "bg-slate-50 text-slate-600"}`}>{type}</span>;
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast}/>
      <ConfirmModal open={!!delId} onCancel={()=>setDelId(null)} onConfirm={handleDelete}
        title="Delete Entry?" message="This will permanently delete this ledger entry."/>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{fontFamily:"'Syne',sans-serif"}}>Ledger Master</h1>
          <p className="text-slate-500 text-sm mt-0.5">{ledger.length} parties — suppliers &amp; customers</p>
        </div>
        <PrimaryBtn onClick={openAdd}><Plus size={15}/>Add Party</PrimaryBtn>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search by name or type…"
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-sm"/>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {filtered.length === 0
          ? <Empty icon={BookUser} title="No parties found" sub="Add suppliers and customers using the button above"/>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                    {["#","Name","Type","Phone","GSTIN","Address","Actions"].map(h=>(
                      <th key={h} className="text-left px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, idx) => (
                    <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                      <td className="px-5 py-4 font-semibold text-slate-800">{entry.name}</td>
                      <td className="px-5 py-4">{typeBadge(entry.type)}</td>
                      <td className="px-5 py-4 text-slate-600">{entry.phone || "—"}</td>
                      <td className="px-5 py-4 text-slate-400 font-mono text-xs">{entry.gstin || "—"}</td>
                      <td className="px-5 py-4 text-slate-500 max-w-[200px] truncate">{entry.address || "—"}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={()=>openEdit(entry)} className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"><Pencil size={14}/></button>
                          <button onClick={()=>setDelId(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title={editId?"Edit Party":"Add New Party"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name *">
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
              placeholder="Supplier / Customer name" className={inputCls}/>
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className={inputCls}>
              {TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}
                placeholder="Mobile number" className={inputCls}/>
            </Field>
            <Field label="GSTIN">
              <input value={form.gstin} onChange={e=>setForm({...form,gstin:e.target.value})}
                placeholder="GST number" className={inputCls}/>
            </Field>
          </div>
          <Field label="Address">
            <textarea rows={2} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}
              placeholder="Full address" className={`${inputCls} resize-none`}/>
          </Field>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={()=>setModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <SaveBtn>{editId?"Update Party":"Add Party"}</SaveBtn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
