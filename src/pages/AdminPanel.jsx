import { useState } from "react";
import { Plus, Trash2, ShieldCheck, Users, Tag, Ruler, Clock, CheckCircle, XCircle, RefreshCw, Zap, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { format } from "date-fns";
import { Toast, useToast, Field, inputCls } from "../components/ui";

const TABS = [
  { id:"categories", label:"Categories",   icon:Tag       },
  { id:"units",      label:"Units",        icon:Ruler     },
  { id:"events",     label:"Event Master", icon:Zap        },
  { id:"users",      label:"Users",        icon:Users     },
  { id:"logs",       label:"Login Report", icon:Clock     },
];

// ── Master list editor (Categories / Units) ───────────────────
function MasterList({ items, onAdd, onToggle, onDelete, noun }) {
  const [newName, setNewName] = useState("");
  const [saving,  setSaving]  = useState(false);
  const [busyId,  setBusyId]  = useState(null);
  const [toast,   showToast]  = useToast();

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const exists = items.some(i => i.name.toLowerCase() === name.toLowerCase());
    if (exists) { showToast(`"${name}" already exists`, "error"); return; }
    setSaving(true);
    try {
      await onAdd(name);
      setNewName("");
      showToast(`${noun} added!`);
    } catch { showToast(`Error adding ${noun}`, "error"); }
    finally   { setSaving(false); }
  };

  const handleToggle = async (item) => {
    setBusyId(item.id);
    try { await onToggle(item.id, { active: !(item.active !== false) }); }
    catch { showToast("Error updating status", "error"); }
    finally { setBusyId(null); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setBusyId(item.id);
    try { await onDelete(item.id); showToast(`${noun} deleted`); }
    catch { showToast(`Error deleting ${noun}`, "error"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <Toast toast={toast}/>
      <div className="flex gap-3">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder={`New ${noun} name…`}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        <button onClick={handleAdd} disabled={saving || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
          style={{background:"linear-gradient(135deg,#0f766e,#0d9488)"}}>
          <Plus size={15}/>{saving ? "Adding…" : `Add ${noun}`}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            No {noun.toLowerCase()}s yet — add your first one above
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3.5">#</th>
                <th className="text-left px-5 py-3.5">{noun} Name</th>
                <th className="text-left px-5 py-3.5">Status</th>
                <th className="text-left px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{idx+1}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{item.name}</td>
                  <td className="px-5 py-3.5">
                    {item.active !== false
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit"><CheckCircle size={11}/>Active</span>
                      : <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg w-fit"><XCircle size={11}/>Inactive</span>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button onClick={() => handleToggle(item)} disabled={busyId === item.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50
                          ${item.active !== false
                            ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          }`}>
                        {item.active !== false ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => handleDelete(item)} disabled={busyId === item.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors disabled:opacity-50">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Event Master tab — name + type (Add/Less) ──────────────────
function EventMaster({ events, onAdd, onToggle, onDelete }) {
  const [name,   setName]   = useState("");
  const [type,   setType]   = useState("Add");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [toast,  showToast] = useToast();

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = events.some(e => e.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) { showToast(`"${trimmed}" already exists`, "error"); return; }
    setSaving(true);
    try {
      await onAdd(trimmed, type);
      setName("");
      showToast("Event added!");
    } catch { showToast("Error adding event", "error"); }
    finally   { setSaving(false); }
  };

  const handleToggle = async (item) => {
    setBusyId(item.id);
    try { await onToggle(item.id, { active: !(item.active !== false) }); }
    catch { showToast("Error updating status", "error"); }
    finally { setBusyId(null); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setBusyId(item.id);
    try { await onDelete(item.id); showToast("Event deleted"); }
    catch { showToast("Error deleting event", "error"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <Toast toast={toast}/>

      {/* Add new event */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Field label="Event Name">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Damage, Bonus, Sample Given"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              className={inputCls}/>
          </Field>
        </div>
        <div className="w-40">
          <Field label="Type">
            <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
              <option value="Add">Add (+)</option>
              <option value="Less">Less (−)</option>
            </select>
          </Field>
        </div>
        <button onClick={handleAdd} disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all whitespace-nowrap"
          style={{background:"linear-gradient(135deg,#0f766e,#0d9488)"}}>
          <Plus size={15}/>{saving ? "Adding…" : "Add Event"}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {events.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            No events yet — add your first one above
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3.5">#</th>
                <th className="text-left px-5 py-3.5">Event Name</th>
                <th className="text-left px-5 py-3.5">Type</th>
                <th className="text-left px-5 py-3.5">Status</th>
                <th className="text-left px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{idx+1}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{item.name}</td>
                  <td className="px-5 py-3.5">
                    {item.type === "Add"
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit"><ArrowUpCircle size={12}/>Add (+)</span>
                      : <span className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit"><ArrowDownCircle size={12}/>Less (−)</span>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    {item.active !== false
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit"><CheckCircle size={11}/>Active</span>
                      : <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg w-fit"><XCircle size={11}/>Inactive</span>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button onClick={() => handleToggle(item)} disabled={busyId === item.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50
                          ${item.active !== false
                            ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          }`}>
                        {item.active !== false ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => handleDelete(item)} disabled={busyId === item.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors disabled:opacity-50">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────
function UsersTab({ users, onToggle }) {
  const [toast, showToast] = useToast();
  const [busyId, setBusyId] = useState(null);

  const handleToggle = async (uid, active) => {
    setBusyId(uid);
    try {
      await onToggle(uid, { active: !active });
      showToast(`User ${!active ? "activated" : "deactivated"}!`);
    } catch {
      showToast("Error updating user", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Toast toast={toast}/>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            No users found. Make sure users are saved to Firestore on signup.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                {["#","Name","Email","Role","Status","Actions"].map(h=>(
                  <th key={h} className="text-left px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800">{user.name || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">{user.email}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold
                      ${user.role === "admin" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                      {user.role || "user"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {user.active !== false
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit"><CheckCircle size={11}/>Active</span>
                      : <span className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit"><XCircle size={11}/>Inactive</span>
                    }
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => handleToggle(user.id, user.active !== false)} disabled={busyId === user.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50
                        ${user.active !== false
                          ? "bg-red-50 text-red-500 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        }`}>
                      {user.active !== false ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Login Logs tab ────────────────────────────────────────────
function LogsTab({ loginLogs }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {loginLogs.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">No login records yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                {["#","Name","Email","Login Time","Device"].map(h=>(
                  <th key={h} className="text-left px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loginLogs.map((log, idx) => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800">{log.name || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">{log.email}</td>
                  <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                    {log.loginAt ? format(log.loginAt, "dd MMM yyyy · hh:mm a") : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium
                      ${log.device === "Mobile" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                      {log.device || "Desktop"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────
export default function AdminPanel({
  categories, units, events, users, loginLogs, loading, error,
  addCategory, updateCategory, deleteCategory,
  addUnit, updateUnit, deleteUnit,
  addEvent, updateEvent, deleteEvent,
  updateUser, refetch,
}) {
  const [tab, setTab] = useState("categories");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" style={{fontFamily:"'Syne',sans-serif"}}>
            <ShieldCheck size={24} className="text-teal-600"/> Admin Panel
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage master data, users and login activity</p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""}/>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === id
                ? "text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            style={tab === id ? {background:"linear-gradient(135deg,#0f766e,#0d9488)"} : {}}>
            <Icon size={15}/>{label}
            {id === "categories" && <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-md">{categories.length}</span>}
            {id === "units"      && <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-md">{units.length}</span>}
            {id === "events"     && <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-md">{events.length}</span>}
            {id === "users"      && <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-md">{users.length}</span>}
            {id === "logs"       && <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-md">{loginLogs.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"/>
          <p className="text-sm">Loading…</p>
        </div>
      ) : (
        <>
          {tab === "categories" && (
            <MasterList items={categories} noun="Category"
              onAdd={addCategory} onToggle={updateCategory} onDelete={deleteCategory}/>
          )}
          {tab === "units" && (
            <MasterList items={units} noun="Unit"
              onAdd={addUnit} onToggle={updateUnit} onDelete={deleteUnit}/>
          )}
          {tab === "events" && (
            <EventMaster events={events}
              onAdd={addEvent} onToggle={updateEvent} onDelete={deleteEvent}/>
          )}
          {tab === "users" && (
            <UsersTab users={users} onToggle={updateUser}/>
          )}
          {tab === "logs" && (
            <LogsTab loginLogs={loginLogs}/>
          )}
        </>
      )}
    </div>
  );
}