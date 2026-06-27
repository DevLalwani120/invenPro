import { useState, useMemo } from "react";
import { format } from "date-fns";
import { BookOpen, TrendingUp, TrendingDown } from "lucide-react";
import { Field, inputCls, Empty } from "../components/ui";
import { DateRangePicker } from "../components/DateRangePicker";
import { computeRangeBatchLedger } from "../firebase/stock";

export default function BatchLedger({ items, batches, events, ledger, batchTxnMap }) {
  const [itemId,  setItemId]  = useState("");
  const [batchId, setBatchId] = useState("");
  const [range,   setRange]   = useState({ from: null, to: null });

  const safeItems   = items   || [];
  const safeBatches = batches || [];
  const safeEvents  = events  || [];
  const safeLedger  = ledger  || [];

  const itemMap   = Object.fromEntries(safeItems.map(i => [i.id, i]));
  const eventMap  = Object.fromEntries(safeEvents.map(e => [e.id, e]));
  const ledgerMap = Object.fromEntries(safeLedger.map(l => [l.id, l]));

  const itemBatches = useMemo(
    () => safeBatches.filter(b => b.itemId === itemId),
    [safeBatches, itemId]
  );

  const selectedBatch = itemBatches.find(b => b.id === batchId) || null;

  // Guard: batchTxnMap might briefly be undefined while data is still loading
  const safeTxnMap = batchTxnMap || {};

  const ledgerResult = useMemo(() => {
    if (!selectedBatch) return { openingAtStart: 0, rows: [], closingAtEnd: 0 };
    try {
      return computeRangeBatchLedger(selectedBatch, safeTxnMap, range);
    } catch (e) {
      console.error("Batch ledger compute error:", e);
      return { openingAtStart: 0, rows: [], closingAtEnd: 0 };
    }
  }, [selectedBatch, safeTxnMap, range]);

  const { openingAtStart, rows: ledgerRows, closingAtEnd } = ledgerResult;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" style={{fontFamily:"'Syne',sans-serif"}}>
          <BookOpen size={24} className="text-teal-600"/> Batch Ledger
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Opening → Transaction → Closing balance for any date range</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Select Item">
          <select value={itemId} onChange={e => { setItemId(e.target.value); setBatchId(""); }} className={inputCls}>
            <option value="">— Select Item —</option>
            {safeItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        <Field label="Select Batch">
          <select value={batchId} onChange={e => setBatchId(e.target.value)} className={inputCls} disabled={!itemId}>
            <option value="">— Select Batch —</option>
            {itemBatches.map(b => (
              <option key={b.id} value={b.id}>{b.batchNo} · Opening: {b.quantity}</option>
            ))}
          </select>
        </Field>
      </div>

      <DateRangePicker value={range} onChange={setRange}/>

      {selectedBatch && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-teal-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Batch No</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{selectedBatch.batchNo}</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Expiry Date</p>
            <p className="text-lg font-bold text-slate-800 mt-1">
              {selectedBatch.expiryDate ? format(selectedBatch.expiryDate, "dd MMM yyyy") : "—"}
            </p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Opening (Range Start)</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{openingAtStart} {itemMap[itemId]?.unit}</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Closing (Range End)</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{closingAtEnd} {itemMap[itemId]?.unit}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {!batchId ? (
          <Empty icon={BookOpen} title="Select an item and batch" sub="Choose a batch above to view its full transaction ledger"/>
        ) : ledgerRows.length === 0 ? (
          <Empty icon={BookOpen} title="No transactions in this range" sub="Try a wider date range or select All Time"/>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                  {["#","Date","Event","Doc/Ref No","Ledger","Qty","Rate","Amount","Opening","Closing"].map(h=>(
                    <th key={h} className="text-left px-5 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row, idx) => {
                  const ev    = eventMap[row.eventId];
                  const party = ledgerMap[row.ledgerId];
                  const isAdd = ev?.type === "Add";
                  return (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 text-slate-400 text-xs">{idx+1}</td>
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                        {row.date ? format(row.date, "dd MMM yyyy") : "—"}
                      </td>
                      <td className="px-5 py-4">
                        {ev && (
                          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium w-fit
                            ${isAdd ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {isAdd ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                            {ev.name}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">{row.docNo || "—"}</td>
                      <td className="px-5 py-4 text-slate-500">{party?.name ?? "—"}</td>
                      <td className={`px-5 py-4 font-semibold ${isAdd ? "text-emerald-600" : "text-red-500"}`}>
                        {isAdd ? "+" : "−"}{row.qty}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.rate != null ? `₹${row.rate}` : "—"}</td>
                      <td className="px-5 py-4 text-slate-700">{row.amount != null ? `₹${row.amount}` : "—"}</td>
                      <td className="px-5 py-4 text-slate-500">{row.openingQty}</td>
                      <td className="px-5 py-4 font-bold text-slate-800">{row.closingQty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
