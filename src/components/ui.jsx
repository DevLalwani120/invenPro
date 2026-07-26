import { useState } from "react";
import { X, CheckCircle, AlertTriangle, Trash2 } from "lucide-react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  return [toast, show];
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-5 right-5 z-[999] flex items-center gap-2 px-4 py-3
      rounded-xl shadow-xl text-sm font-semibold
      ${toast.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
      {toast.type === "error" ? <AlertTriangle size={15}/> : <CheckCircle size={15}/>}
      {toast.msg}
    </div>
  );
}

export function ConfirmModal({ open, onCancel, onConfirm, title, message }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-red-100 rounded-xl"><Trash2 className="text-red-500" size={18}/></div>
          <h3 className="font-bold text-slate-800">{title}</h3>
        </div>
        <p className="text-slate-500 text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl w-full shadow-2xl max-h-[92vh] overflow-y-auto ${wide ? "max-w-6xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-base" style={{fontFamily:"'Syne',sans-serif"}}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white transition-colors";

export function PrimaryBtn({ children, onClick, type = "button", disabled = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{background:"linear-gradient(135deg,#0f766e,#0d9488)"}}>
      {children}
    </button>
  );
}

export function SaveBtn({ children = "Save" }) {
  return (
    <button type="submit"
      className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold shadow hover:shadow-md transition-all"
      style={{background:"linear-gradient(135deg,#0f766e,#0d9488)"}}>
      {children}
    </button>
  );
}

export function Empty({ icon: Icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 select-none">
      <Icon size={48} className="mb-3 opacity-20"/>
      <p className="font-semibold text-slate-500">{title}</p>
      <p className="text-sm mt-1">{sub}</p>
    </div>
  );
}

export function StatusBadge({ ok }) {
  return ok
    ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit"><CheckCircle size={11}/>OK</span>
    : <span className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit"><AlertTriangle size={11}/>Low</span>;
}
