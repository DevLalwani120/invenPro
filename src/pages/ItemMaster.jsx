import { useState } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Toast, useToast, ConfirmModal, Modal, Field, inputCls, PrimaryBtn, SaveBtn, Empty, StatusBadge } from "../components/ui";

const EMPTY = { name:"", category:"", unit:"", description:"", minStockLevel:"" };

export default function ItemMaster({ items, stockMap, addItem, updateItem, deleteItem, categories, units }) {
  const [form,   setForm]   = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [modal,  setModal]  = useState(false);
  const [delId,  setDelId]  = useState(null);
  const [search, setSearch] = useState("");
  const [toast,  showToast] = useToast();

  // Only active categories and units
  const activeCategories = categories.filter(c => c.active !== false);
  const activeUnits      = units.filter(u => u.active !== false);

  const openAdd  = ()     => {
    setForm({ ...EMPTY, category: activeCategories[0]?.name || "", unit: activeUnits[0]?.name || "" });
    setEditId(null); setModal(true);
  };
  const openEdit = (item) => {
    setForm({ name:item.name||"", category:item.category||"",
      unit:item.unit||"", description:item.description||"",
      minStockLevel:item.minStockLevel??"" });
    setEditId(item.id); setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (editId) { await updateItem(editId, form); showToast("Item updated!"); }
      else        { await addItem(form);             showToast("Item added!");   }
      setModal(false);
    } catch { showToast("Error saving item","error"); }
  };

  const handleDelete = async () => { await deleteItem(delId); setDelId(null); showToast("Item deleted"); };

  const filtered = items.filter(i =>
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Toast toast={toast}/>
      <ConfirmModal open={!!delId} onCancel={()=>setDelId(null)} onConfirm={handleDelete}
        title="Delete Item?" message="This will permanently delete the item and all its batches."/>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{fontFamily:"'Syne',sans-serif"}}>Item Master</h1>
          <p className="text-slate-500 text-sm mt-0.5">{items.length} items in catalog</p>
        </div>
        <PrimaryBtn onClick={openAdd}><Plus size={15}/>Add Item</PrimaryBtn>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search by name or category…"
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-sm"/>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {filtered.length === 0
          ? <Empty icon={Package} title="No items found" sub="Add your first item using the button above"/>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                    {["#","Item Name","Category","Unit","Stock","Min Level","Status","Actions"].map(h=>(
                      <th key={h} className="text-left px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const stock = stockMap[item.id] ?? 0;
                    const isLow = item.minStockLevel != null && stock <= Number(item.minStockLevel);
                    return (
                      <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{item.name}</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-700">{item.category}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{item.unit}</td>
                        <td className="px-5 py-4">
                          <span className={`font-bold text-base ${isLow?"text-red-500":"text-slate-800"}`}>{stock}</span>
                          <span className="text-slate-400 text-xs ml-1">{item.unit}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-500">{item.minStockLevel ?? "—"}</td>
                        <td className="px-5 py-4"><StatusBadge ok={!isLow}/></td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button onClick={()=>openEdit(item)} className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"><Pencil size={14}/></button>
                            <button onClick={()=>setDelId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={14}/></button>
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

      <Modal open={modal} onClose={()=>setModal(false)} title={editId?"Edit Item":"Add New Item"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Item Name *">
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
              placeholder="e.g. Paracetamol 500mg" className={inputCls}/>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className={inputCls}>
                {activeCategories.map(c=><option key={c.id||c.name} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Unit">
              <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} className={inputCls}>
                {activeUnits.map(u=><option key={u.id||u.name} value={u.name}>{u.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Min Stock Level ⚠️">
            <input type="number" min="0" value={form.minStockLevel}
              onChange={e=>setForm({...form,minStockLevel:e.target.value})}
              placeholder="Show alert below this quantity" className={inputCls}/>
          </Field>
          <Field label="Description">
            <textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
              placeholder="Optional notes" className={`${inputCls} resize-none`}/>
          </Field>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={()=>setModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <SaveBtn>{editId?"Update Item":"Add Item"}</SaveBtn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
