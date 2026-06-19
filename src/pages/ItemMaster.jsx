import { useState } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Toast, useToast, ConfirmModal, Modal, Field, inputCls, PrimaryBtn, SaveBtn, Empty, StatusBadge } from "../components/ui";

const EMPTY = {
  name:"", category:"", unit:"", description:"", minStockLevel:"",
  hasSecondaryUnit:false,
  primaryQty:"1", secondaryUnit:"", secondaryQty:"",
};

export default function ItemMaster({ items, stockMap, addItem, updateItem, deleteItem, categories, units }) {
  const [form,   setForm]   = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [modal,  setModal]  = useState(false);
  const [delId,  setDelId]  = useState(null);
  const [search, setSearch] = useState("");
  const [toast,  showToast] = useToast();

  const activeCategories = categories.filter(c => c.active !== false);
  const activeUnits      = units.filter(u => u.active !== false);

  // Conversion rate = how many secondary units per 1 primary unit
  const computeConversionRate = (primaryQty, secondaryQty) => {
    const p = Number(primaryQty);
    const s = Number(secondaryQty);
    if (!p || !s) return 0;
    return s / p; // e.g. 15 kg / 1 tin = 15 per tin
  };

  const openAdd  = ()     => {
    setForm({ ...EMPTY, category: activeCategories[0]?.name || "", unit: activeUnits[0]?.name || "" });
    setEditId(null); setModal(true);
  };

  const openEdit = (item) => {
    // Reconstruct primaryQty/secondaryQty display from stored conversionRate
    // Default to "1" primary = conversionRate secondary
    setForm({
      name:item.name||"", category:item.category||"",
      unit:item.unit||"", description:item.description||"",
      minStockLevel:item.minStockLevel??"",
      hasSecondaryUnit: item.hasSecondaryUnit || false,
      primaryQty:    item.hasSecondaryUnit ? (item.primaryQty ?? "1") : "1",
      secondaryUnit: item.secondaryUnit    || "",
      secondaryQty:  item.hasSecondaryUnit ? (item.secondaryQty ?? "") : "",
    });
    setEditId(item.id); setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = { ...form };
    if (!payload.hasSecondaryUnit) {
      payload.secondaryUnit  = "";
      payload.primaryQty     = "";
      payload.secondaryQty   = "";
      payload.conversionRate = 0;
    } else {
      payload.primaryQty     = Number(payload.primaryQty) || 1;
      payload.secondaryQty   = Number(payload.secondaryQty) || 0;
      payload.conversionRate = computeConversionRate(payload.primaryQty, payload.secondaryQty);
    }

    try {
      if (editId) { await updateItem(editId, payload); showToast("Item updated!"); }
      else        { await addItem(payload);             showToast("Item added!");   }
      setModal(false);
    } catch { showToast("Error saving item","error"); }
  };

  const handleDelete = async () => { await deleteItem(delId); setDelId(null); showToast("Item deleted"); };

  const filtered = items.filter(i =>
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.category?.toLowerCase().includes(search.toLowerCase())
  );

  const formatStock = (item, stock) => {
    if (item.hasSecondaryUnit && item.conversionRate > 0) {
      const secondaryQty = (stock * Number(item.conversionRate)).toFixed(2).replace(/\.?0+$/, "");
      return (
        <>
          <span className="font-bold text-base">{stock}</span>
          <span className="text-slate-400 text-xs ml-1">{item.unit}</span>
          <span className="text-teal-600 text-xs ml-1.5 bg-teal-50 px-1.5 py-0.5 rounded-md">
            ({secondaryQty} {item.secondaryUnit})
          </span>
        </>
      );
    }
    return (
      <>
        <span className="font-bold text-base">{stock}</span>
        <span className="text-slate-400 text-xs ml-1">{item.unit}</span>
      </>
    );
  };

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
                        <td className="px-5 py-4 text-slate-600">
                          {item.unit}
                          {item.hasSecondaryUnit && (
                            <span className="text-slate-400 text-xs ml-1">/ {item.secondaryUnit}</span>
                          )}
                        </td>
                        <td className={`px-5 py-4 ${isLow ? "text-red-500" : "text-slate-800"}`}>
                          {formatStock(item, stock)}
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
              placeholder="e.g. Ghee" className={inputCls}/>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className={inputCls}>
                {activeCategories.map(c=><option key={c.id||c.name} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Primary Unit">
              <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} className={inputCls}>
                {activeUnits.map(u=><option key={u.id||u.name} value={u.name}>{u.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Secondary unit toggle */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.hasSecondaryUnit}
                onChange={e => setForm({ ...form, hasSecondaryUnit: e.target.checked })}
                className="w-4 h-4 rounded accent-teal-600"/>
              <span className="text-sm font-semibold text-slate-700">This item has a secondary unit</span>
            </label>
            <p className="text-xs text-slate-400 mt-1 ml-6.5">
              e.g. Ghee sold in Tins but also tracked in Kg
            </p>

            {form.hasSecondaryUnit && (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Set Conversion
                </p>
                <div className="flex items-center gap-2.5">
                  {/* Primary qty */}
                  <input type="number" min="0" step="0.001" value={form.primaryQty}
                    onChange={e=>setForm({...form,primaryQty:e.target.value})}
                    placeholder="1"
                    className="w-20 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"/>
                  <span className="text-sm font-semibold text-slate-600 shrink-0">{form.unit || "unit"}</span>

                  <span className="text-slate-400 font-bold shrink-0">=</span>

                  {/* Secondary unit dropdown */}
                  <select value={form.secondaryUnit} onChange={e=>setForm({...form,secondaryUnit:e.target.value})}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                    <option value="">— Unit —</option>
                    {activeUnits.filter(u => u.name !== form.unit).map(u=>(
                      <option key={u.id||u.name} value={u.name}>{u.name}</option>
                    ))}
                  </select>

                  {/* Secondary qty */}
                  <input type="number" min="0" step="0.001" value={form.secondaryQty}
                    onChange={e=>setForm({...form,secondaryQty:e.target.value})}
                    placeholder="15"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
                </div>
                {form.primaryQty && form.secondaryUnit && form.secondaryQty && (
                  <p className="text-xs text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg">
                    ✓ {form.primaryQty} {form.unit} = {form.secondaryQty} {form.secondaryUnit}
                  </p>
                )}
              </div>
            )}
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